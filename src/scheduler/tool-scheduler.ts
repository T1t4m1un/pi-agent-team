import { resolve, normalize } from "node:path";

export interface ScheduledToolCall {
  id: string;
  actorId: string;
  toolName: string;
  args: Record<string, unknown>;
  execute: () => Promise<ToolExecutionResult>;
}

export interface ToolExecutionResult {
  content: { type: "text"; text: string }[];
  isError: boolean;
}

type ToolExecutor = (call: ScheduledToolCall) => Promise<ToolExecutionResult>;

interface ActiveOperation {
  actorId: string;
  filePath?: string;
  isWrite: boolean;
}

const WRITE_TOOLS = new Set(["write_file", "edit_file"]);
const READ_TOOLS = new Set(["read_file"]);
const FILE_TOOLS = new Set([...WRITE_TOOLS, ...READ_TOOLS]);

export class ToolScheduler {
  private toolExecutors = new Map<string, ToolExecutor>();
  private toolQueues = new Map<string, ScheduledToolCall[]>();
  private activeByType = new Map<string, boolean>();
  private activeFileOps = new Map<string, ActiveOperation[]>();
  private processing = new Set<string>();

  registerExecutor(toolName: string, executor: ToolExecutor): void {
    this.toolExecutors.set(toolName, executor);
  }

  async schedule(call: ScheduledToolCall): Promise<ToolExecutionResult> {
    const queue = this.toolQueues.get(call.toolName) || [];
    this.toolQueues.set(call.toolName, queue);

    return new Promise<ToolExecutionResult>((resolvePromise, _reject) => {
      queue.push({
        ...call,
        execute: async () => {
          try {
            const result = await this.executeWithFileChecks(call);
            resolvePromise(result);
            return result;
          } catch (err) {
            const result: ToolExecutionResult = {
              content: [{ type: "text", text: String(err) }],
              isError: true,
            };
            resolvePromise(result);
            return result;
          }
        },
      } as ScheduledToolCall);

      this.processQueue(call.toolName);
    });
  }

  private async executeWithFileChecks(call: ScheduledToolCall): Promise<ToolExecutionResult> {
    const filePath = this.extractFilePath(call);
    const isWrite = WRITE_TOOLS.has(call.toolName as string);

    if (filePath && FILE_TOOLS.has(call.toolName as string)) {
      await this.waitForFileAccess(call.actorId, filePath, isWrite);
      this.registerFileOp(call.actorId, filePath, isWrite);
    }

    try {
      const executor = this.toolExecutors.get(call.toolName);
      if (!executor) {
        return {
          content: [{ type: "text", text: `No executor registered for tool: ${call.toolName}` }],
          isError: true,
        };
      }
      return await executor(call);
    } finally {
      if (filePath) {
        this.unregisterFileOp(call.actorId, filePath);
      }
    }
  }

  private extractFilePath(call: ScheduledToolCall): string | undefined {
    const pathArg = call.args.path || call.args.file_path || call.args.filePath;
    if (typeof pathArg === "string") {
      return normalize(resolve(pathArg));
    }
    return undefined;
  }

  private async waitForFileAccess(
    actorId: string,
    filePath: string,
    isWrite: boolean,
  ): Promise<void> {
    const maxWait = 30_000;
    const interval = 50;
    let waited = 0;

    while (waited < maxWait) {
      const ops = this.activeFileOps.get(filePath) || [];

      if (isWrite) {
        if (ops.length === 0) return;
      } else {
        if (!ops.some((op) => op.isWrite)) return;
      }

      await new Promise((r) => setTimeout(r, interval));
      waited += interval;
    }

    throw new Error(`Timeout waiting for file access: ${filePath}`);
  }

  private registerFileOp(actorId: string, filePath: string, isWrite: boolean): void {
    const ops = this.activeFileOps.get(filePath) || [];
    ops.push({ actorId, filePath, isWrite });
    this.activeFileOps.set(filePath, ops);
  }

  private unregisterFileOp(actorId: string, filePath: string): void {
    const ops = this.activeFileOps.get(filePath) || [];
    const idx = ops.findIndex((op) => op.actorId === actorId);
    if (idx >= 0) ops.splice(idx, 1);
    if (ops.length === 0) {
      this.activeFileOps.delete(filePath);
    } else {
      this.activeFileOps.set(filePath, ops);
    }
  }

  private processQueue(toolName: string): void {
    if (this.processing.has(toolName)) return;

    const queue = this.toolQueues.get(toolName);
    if (!queue || queue.length === 0) return;

    this.processing.add(toolName);
    const call = queue.shift()!;

    call
      .execute()
      .catch(() => {})
      .finally(() => {
        this.processing.delete(toolName);
        const remaining = this.toolQueues.get(toolName);
        if (remaining && remaining.length > 0) {
          this.processQueue(toolName);
        }
      });
  }

  getQueueDepth(toolName?: string): number {
    if (toolName) {
      return (this.toolQueues.get(toolName) || []).length;
    }
    let total = 0;
    for (const queue of this.toolQueues.values()) {
      total += queue.length;
    }
    return total;
  }
}
