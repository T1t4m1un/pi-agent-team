import { MESSAGE_TYPES } from "@/types.js";
import type { TeamMessage } from "@/types.js";

export type MessageHandler = (message: TeamMessage) => void | Promise<void>;

const VALID_TYPES = new Set<string>(MESSAGE_TYPES);

export function validateMessage(msg: Partial<TeamMessage>): TeamMessage {
  if (!msg.id || typeof msg.id !== "string") {
    throw new Error("TeamMessage requires a string 'id' field");
  }
  if (!msg.from || typeof msg.from !== "string") {
    throw new Error("TeamMessage requires a string 'from' field");
  }
  if (!msg.to || typeof msg.to !== "string") {
    throw new Error("TeamMessage requires a string 'to' field");
  }
  if (!msg.type || !VALID_TYPES.has(msg.type)) {
    throw new Error(
      `TeamMessage has invalid 'type': ${msg.type}. Valid types: ${MESSAGE_TYPES.join(", ")}`,
    );
  }
  if (msg.payload === undefined) {
    throw new Error("TeamMessage requires a 'payload' field");
  }
  if (!msg.timestamp || typeof msg.timestamp !== "string") {
    throw new Error("TeamMessage requires a string 'timestamp' field");
  }
  return msg as TeamMessage;
}

let messageCounter = 0;

export function createMessage(
  from: string,
  to: string,
  type: TeamMessage["type"],
  payload: unknown,
  options?: { replyTo?: string },
): TeamMessage {
  messageCounter++;
  return validateMessage({
    id: `msg_${Date.now()}_${messageCounter}_${Math.random().toString(36).slice(2, 8)}`,
    from,
    to,
    type,
    payload,
    timestamp: new Date().toISOString(),
    replyTo: options?.replyTo,
  });
}

export function resetMessageCounter(): void {
  messageCounter = 0;
}
