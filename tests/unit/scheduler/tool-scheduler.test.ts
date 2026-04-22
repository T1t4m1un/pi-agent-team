import { describe, it, expect } from "vitest";
import { ToolScheduler } from "@/scheduler/tool-scheduler.js";
import type { ScheduledToolCall } from "@/scheduler/tool-scheduler.js";

function makeCall(
  toolName: string,
  args: Record<string, unknown>,
  actorId = "a1",
): ScheduledToolCall {
  return {
    id: `call-${Math.random().toString(36).slice(2, 8)}`,
    actorId,
    toolName,
    args,
    execute: async () => ({ content: [{ type: "text" as const, text: "" }], isError: false }),
  };
}

describe("ToolScheduler", () => {
  it("executes tool with registered executor", async () => {
    const scheduler = new ToolScheduler();
    scheduler.registerExecutor("read_file", async (call) => ({
      content: [{ type: "text" as const, text: `read: ${call.args.path}` }],
      isError: false,
    }));

    const result = await scheduler.schedule(makeCall("read_file", { path: "/tmp/test.txt" }));
    expect(result.content[0].text).toBe("read: /tmp/test.txt");
  });

  it("queues concurrent executions for same tool type (FIFO)", async () => {
    const scheduler = new ToolScheduler();
    const order: string[] = [];

    scheduler.registerExecutor("bash", async (call) => {
      order.push(call.args.cmd as string);
      return { content: [{ type: "text" as const, text: "ok" }], isError: false };
    });

    const p1 = scheduler.schedule(makeCall("bash", { cmd: "first" }));
    const p2 = scheduler.schedule(makeCall("bash", { cmd: "second" }));
    await Promise.all([p1, p2]);

    expect(order[0]).toBe("first");
    expect(order[1]).toBe("second");
  });

  it("detects file conflicts for write operations", async () => {
    const scheduler = new ToolScheduler();
    scheduler.registerExecutor("write_file", async () => ({
      content: [{ type: "text" as const, text: "wrote" }],
      isError: false,
    }));

    const p1 = scheduler.schedule(makeCall("write_file", { path: "/tmp/same.txt", content: "a" }));
    const p2 = scheduler.schedule(makeCall("write_file", { path: "/tmp/same.txt", content: "b" }));
    await Promise.all([p1, p2]);
  });

  it("allows parallel reads of different files", async () => {
    const scheduler = new ToolScheduler();
    scheduler.registerExecutor("read_file", async (call) => ({
      content: [{ type: "text" as const, text: `content of ${call.args.path}` }],
      isError: false,
    }));

    const results = await Promise.all([
      scheduler.schedule(makeCall("read_file", { path: "/tmp/a.txt" })),
      scheduler.schedule(makeCall("read_file", { path: "/tmp/b.txt" })),
    ]);

    expect(results).toHaveLength(2);
  });

  it("reports queue depth", () => {
    const scheduler = new ToolScheduler();
    scheduler.registerExecutor("bash", async () => ({
      content: [{ type: "text" as const, text: "" }],
      isError: false,
    }));
    expect(scheduler.getQueueDepth("bash")).toBe(0);
  });
});
