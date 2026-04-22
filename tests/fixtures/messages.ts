import type { TeamMessage, MessageType } from "@/types.js";

let messageCounter = 0;

export function createTestMessage(overrides: Partial<TeamMessage> = {}): TeamMessage {
  messageCounter++;
  return {
    id: `msg-${messageCounter}`,
    from: overrides.from ?? "lead",
    to: overrides.to ?? "worker-1",
    type: overrides.type ?? "task_assign",
    payload: overrides.payload ?? { task: "test task" },
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    replyTo: overrides.replyTo,
  };
}

export function createTestMessages(
  count: number,
  type: MessageType = "task_assign",
): TeamMessage[] {
  return Array.from({ length: count }, () => createTestMessage({ type }));
}
