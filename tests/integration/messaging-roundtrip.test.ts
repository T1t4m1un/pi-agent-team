import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestMessage } from "@test/fixtures/messages.js";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EventBus } from "@/messaging/event-bus.js";
import { JsonlInbox } from "@/messaging/jsonl-inbox.js";
import { createMessage } from "@/messaging/message.js";

describe("EventBus + JsonlInbox integration", () => {
  let testDir: string;
  let bus: EventBus;
  let inbox: JsonlInbox;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "pi-team-integ-"));
    bus = new EventBus();
    inbox = new JsonlInbox("test-team", "worker-1", testDir);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("persists messages received through event bus", async () => {
    bus.subscribe("worker-1", async (msg) => {
      await inbox.append({ direction: "in", message: msg });
    });

    const msg = createTestMessage({ to: "worker-1", type: "task_assign" });
    bus.publish(msg);

    await new Promise((r) => setTimeout(r, 50));
    const entries = await inbox.readAll();
    expect(entries).toHaveLength(1);
    expect(entries[0].message.type).toBe("task_assign");
  });

  it("handles message round-trip: assign → result", async () => {
    const leadInbox = new JsonlInbox("test-team", "lead", testDir);
    const workerInbox = new JsonlInbox("test-team", "worker-1", testDir);

    bus.subscribe("worker-1", async (msg) => {
      await workerInbox.append({ direction: "in", message: msg });
      const reply = createMessage(
        "worker-1",
        "lead",
        "task_result",
        {
          status: "success",
          result: "done",
          actorId: "worker-1",
        },
        { replyTo: msg.id },
      );
      bus.publish(reply);
    });

    bus.subscribe("lead", async (msg) => {
      await leadInbox.append({ direction: "in", message: msg });
    });

    const assignMsg = createTestMessage({ from: "lead", to: "worker-1", type: "task_assign" });
    bus.publish(assignMsg);

    await new Promise((r) => setTimeout(r, 100));

    const workerEntries = await workerInbox.readAll();
    expect(workerEntries).toHaveLength(1);

    const leadEntries = await leadInbox.readAll();
    expect(leadEntries).toHaveLength(1);
    expect(leadEntries[0].message.type).toBe("task_result");
  });
});
