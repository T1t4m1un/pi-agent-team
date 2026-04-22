import { describe, it, expect } from "vitest";
import { validateMessage, createMessage } from "@/messaging/message.js";

describe("Message validation and creation", () => {
  it("validates a well-formed message", () => {
    const msg = createMessage("lead", "worker-1", "task_assign", { task: "do stuff" });
    const result = validateMessage(msg);
    expect(result).toBe(msg);
  });

  it("throws on message with missing fields", () => {
    expect(() => validateMessage({} as any)).toThrow(/id/i);
  });

  it("throws on message with invalid type", () => {
    const msg = createMessage("lead", "worker-1", "task_assign", {});
    (msg as any).type = "invalid_type";
    expect(() => validateMessage(msg)).toThrow(/invalid.*type/i);
  });

  it("createMessage generates unique IDs", () => {
    const msg1 = createMessage("a", "b", "task_assign", {});
    const msg2 = createMessage("a", "b", "task_assign", {});
    expect(msg1.id).not.toBe(msg2.id);
  });

  it("createMessage includes timestamp", () => {
    const msg = createMessage("a", "b", "task_assign", {});
    expect(msg.timestamp).toBeTruthy();
  });

  it("createMessage supports replyTo", () => {
    const msg = createMessage(
      "a",
      "b",
      "task_result",
      { status: "success" },
      { replyTo: "msg-123" },
    );
    expect(msg.replyTo).toBe("msg-123");
  });
});
