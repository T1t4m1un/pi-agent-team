import type { AgentTool } from "@mariozechner/pi-agent-core";
import { vi } from "vitest";

export function createMockStreamFn() {
  return vi.fn().mockReturnValue({
    [Symbol.asyncIterator]() {
      return {
        next: () => Promise.resolve({ done: true, value: undefined }),
      };
    },
    result: () => Promise.resolve([]),
    push: vi.fn(),
    end: vi.fn(),
  });
}

export function createMockAgentTool(name: string): AgentTool<any> {
  return {
    name,
    label: name,
    description: `Mock ${name} tool`,
    parameters: {
      type: "object",
      properties: {},
    } as any,
    execute: vi.fn().mockResolvedValue({
      content: [{ type: "text" as const, text: `Mock ${name} result` }],
      details: {},
    }),
  };
}

export function createMockEventBus() {
  const handlers = new Map<string, Set<(msg: any) => void>>();

  return {
    subscribe: vi.fn((actorId: string, handler: (msg: any) => void) => {
      if (!handlers.has(actorId)) handlers.set(actorId, new Set());
      handlers.get(actorId)!.add(handler);
      return () => {
        handlers.get(actorId)?.delete(handler);
      };
    }),
    publish: vi.fn((msg: any) => {
      const direct = handlers.get(msg.to);
      if (direct) for (const h of direct) h(msg);
      const broadcast = handlers.get("broadcast");
      if (broadcast && msg.to !== "broadcast") for (const h of broadcast) h(msg);
    }),
    broadcast: vi.fn(),
    getMessageLog: vi.fn().mockReturnValue([]),
    _handlers: handlers,
  };
}

export function createMockLLMScheduler() {
  return {
    acquire: vi.fn().mockResolvedValue({ release: vi.fn() }),
    release: vi.fn(),
    withConcurrencyControl: vi.fn(<T>(actorId: string, model: string, fn: () => Promise<T>) =>
      fn(),
    ),
    executeWithRetry: vi.fn(<T>(fn: () => Promise<T>) => fn()),
    recordUsage: vi.fn(),
    getTokenUsage: vi.fn().mockReturnValue({}),
    getSessionSummary: vi.fn().mockReturnValue({
      actors: {},
      durationMs: 0,
      taskStats: { completed: 0, failed: 0, total: 0 },
    }),
  };
}

export function createMockToolScheduler() {
  return {
    registerExecutor: vi.fn(),
    schedule: vi.fn().mockResolvedValue({
      content: [{ type: "text" as const, text: "mock result" }],
      details: {},
    }),
    getQueueDepth: vi.fn().mockReturnValue(0),
  };
}
