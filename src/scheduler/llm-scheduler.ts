import type { TokenUsage, ActorTokenUsage, SessionCostSummary } from "@/types.js";

interface PendingRequest {
  execute: () => Promise<void>;
}

interface ModelSlots {
  concurrency: number;
  active: number;
  pending: PendingRequest[];
}

export class LLMScheduler {
  private modelSlots = new Map<string, ModelSlots>();
  private tokenUsage = new Map<string, ActorTokenUsage>();
  private defaultConcurrency: number;
  private maxRetries: number;
  private baseRetryDelayMs: number;
  private modelConcurrencyOverrides: Record<string, number>;
  private sessionStartTime: number;

  constructor(options?: {
    defaultConcurrency?: number;
    maxRetries?: number;
    baseRetryDelayMs?: number;
    modelConcurrency?: Record<string, number>;
  }) {
    this.defaultConcurrency = options?.defaultConcurrency ?? 5;
    this.maxRetries = options?.maxRetries ?? 3;
    this.baseRetryDelayMs = options?.baseRetryDelayMs ?? 1000;
    this.modelConcurrencyOverrides = options?.modelConcurrency ?? {};
    this.sessionStartTime = Date.now();
  }

  private getOrCreateSlots(model: string): ModelSlots {
    let slots = this.modelSlots.get(model);
    if (!slots) {
      slots = {
        concurrency: this.modelConcurrencyOverrides[model] ?? this.defaultConcurrency,
        active: 0,
        pending: [],
      };
      this.modelSlots.set(model, slots);
    }
    return slots;
  }

  async acquire(actorId: string, model: string): Promise<{ release: () => void }> {
    const slots = this.getOrCreateSlots(model);

    if (slots.active >= slots.concurrency) {
      return new Promise<{ release: () => void }>((resolve) => {
        slots.pending.push({
          execute: async () => {
            slots.active++;
            resolve({
              release: () => {
                slots.active--;
                this.dequeue(model);
              },
            });
          },
        });
      });
    }

    slots.active++;
    return {
      release: () => {
        slots.active--;
        this.dequeue(model);
      },
    };
  }

  private dequeue(model: string): void {
    const slots = this.modelSlots.get(model);
    if (!slots || slots.pending.length === 0) return;

    if (slots.active < slots.concurrency) {
      const next = slots.pending.shift()!;
      next.execute().catch(() => {});
    }
  }

  async withConcurrencyControl<T>(
    actorId: string,
    model: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const { release } = await this.acquire(actorId, model);
    try {
      return await this.executeWithRetry(fn);
    } finally {
      release();
    }
  }

  private async executeWithRetry<T>(fn: () => Promise<T>, attempt: number = 0): Promise<T> {
    try {
      return await fn();
    } catch (err: unknown) {
      if (this.is429Error(err) && attempt < this.maxRetries) {
        const delay = this.calculateBackoff(attempt, err);
        await new Promise((r) => setTimeout(r, delay));
        return this.executeWithRetry(fn, attempt + 1);
      }
      throw err;
    }
  }

  private is429Error(err: unknown): boolean {
    if (err && typeof err === "object") {
      const e = err as Record<string, unknown>;
      if (e.status === 429 || e.statusCode === 429) return true;
      if (typeof e.message === "string" && e.message.includes("429")) return true;
    }
    return false;
  }

  private calculateBackoff(attempt: number, err: unknown): number {
    const retryAfter = this.getRetryAfter(err);
    if (retryAfter !== undefined) return retryAfter * 1000;

    const base = this.baseRetryDelayMs;
    const exp = base * Math.pow(2, attempt);
    const jitter = Math.random() * base;
    return exp + jitter;
  }

  private getRetryAfter(err: unknown): number | undefined {
    if (err && typeof err === "object") {
      const e = err as Record<string, unknown>;
      const headers = e.headers as Record<string, string> | undefined;
      if (headers?.["retry-after"]) {
        const val = parseFloat(headers["retry-after"]);
        if (!isNaN(val)) return val;
      }
    }
    return undefined;
  }

  recordUsage(actorId: string, model: string, usage: TokenUsage): void {
    let actorUsage = this.tokenUsage.get(actorId);
    if (!actorUsage) {
      actorUsage = {};
      this.tokenUsage.set(actorId, actorUsage);
    }
    let modelUsage = actorUsage[model];
    if (!modelUsage) {
      modelUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
      actorUsage[model] = modelUsage;
    }
    modelUsage.input += usage.input;
    modelUsage.output += usage.output;
    modelUsage.cacheRead += usage.cacheRead;
    modelUsage.cacheWrite += usage.cacheWrite;
  }

  getTokenUsage(actorId: string): ActorTokenUsage {
    return this.tokenUsage.get(actorId) ?? {};
  }

  getActiveCalls(model?: string): number {
    if (model) {
      return this.modelSlots.get(model)?.active ?? 0;
    }
    let total = 0;
    for (const slots of this.modelSlots.values()) {
      total += slots.active;
    }
    return total;
  }

  getPendingCount(model?: string): number {
    if (model) {
      return this.modelSlots.get(model)?.pending.length ?? 0;
    }
    let total = 0;
    for (const slots of this.modelSlots.values()) {
      total += slots.pending.length;
    }
    return total;
  }

  getSessionSummary(taskStats: {
    completed: number;
    failed: number;
    total: number;
  }): SessionCostSummary {
    const actors: Record<string, ActorTokenUsage> = {};
    for (const [actorId, usage] of this.tokenUsage.entries()) {
      actors[actorId] = usage;
    }
    return {
      actors,
      durationMs: Date.now() - this.sessionStartTime,
      taskStats,
    };
  }
}
