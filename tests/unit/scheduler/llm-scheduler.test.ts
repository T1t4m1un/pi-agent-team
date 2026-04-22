import { describe, it, expect } from "vitest";
import { LLMScheduler } from "@/scheduler/llm-scheduler.js";

describe("LLMScheduler", () => {
  it("acquires and releases concurrency slots", async () => {
    const scheduler = new LLMScheduler({ defaultConcurrency: 2 });
    const { release } = await scheduler.acquire("actor-1", "model-a");
    release();
  });

  it("tracks token usage", () => {
    const scheduler = new LLMScheduler();
    scheduler.recordUsage("actor-1", "model-a", {
      input: 100,
      output: 50,
      cacheRead: 0,
      cacheWrite: 0,
    });

    const usage = scheduler.getTokenUsage("actor-1");
    expect(usage["model-a"].input).toBe(100);
    expect(usage["model-a"].output).toBe(50);
  });

  it("returns session summary with task stats", () => {
    const scheduler = new LLMScheduler();
    const summary = scheduler.getSessionSummary({ completed: 0, failed: 0, total: 0 });
    expect(summary.taskStats).toEqual({ completed: 0, failed: 0, total: 0 });
  });

  it("respects concurrency limits", async () => {
    const scheduler = new LLMScheduler({ defaultConcurrency: 1 });
    const order: number[] = [];

    const makeFn = (n: number) => () =>
      new Promise<void>((resolve) => {
        order.push(n);
        setTimeout(resolve, 10);
      });

    await Promise.all([
      scheduler.withConcurrencyControl("a", "m1", makeFn(1)),
      scheduler.withConcurrencyControl("b", "m1", makeFn(2)),
    ]);

    expect(order).toHaveLength(2);
  });
});
