import { validateMessage } from "@/messaging/message.js";
import type { TeamMessage } from "@/types.js";

export type MessageHandler = (message: TeamMessage) => void | Promise<void>;

export class EventBus {
  private subscribers = new Map<string, MessageHandler[]>();
  private messageLog: TeamMessage[] = [];

  subscribe(actorId: string, handler: MessageHandler): () => void {
    const handlers = this.subscribers.get(actorId) || [];
    handlers.push(handler);
    this.subscribers.set(actorId, handlers);
    return () => {
      const current = this.subscribers.get(actorId) || [];
      this.subscribers.set(
        actorId,
        current.filter((h) => h !== handler),
      );
    };
  }

  publish(message: TeamMessage): void {
    validateMessage(message);
    this.messageLog.push(message);

    if (message.to === "broadcast") {
      for (const [actorId, handlers] of this.subscribers) {
        if (actorId !== message.from) {
          for (const handler of handlers) {
            handler(message);
          }
        }
      }
    } else {
      const handlers = this.subscribers.get(message.to);
      if (handlers) {
        for (const handler of handlers) {
          handler(message);
        }
      }
    }
  }

  broadcast(message: Omit<TeamMessage, "to"> & { to?: string }): void {
    const full: TeamMessage = { ...message, to: "broadcast" } as TeamMessage;
    this.publish(full);
  }

  getMessageLog(): readonly TeamMessage[] {
    return this.messageLog;
  }

  getMessageCount(): number {
    return this.messageLog.length;
  }

  clear(): void {
    this.messageLog = [];
  }

  unsubscribeAll(): void {
    this.subscribers.clear();
  }
}
