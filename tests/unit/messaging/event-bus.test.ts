import { createTestMessage } from "@test/fixtures/messages.js";
import { describe, it, expect } from "vitest";
import { EventBus } from "@/messaging/event-bus.js";

describe("EventBus", () => {
  it("delivers direct messages to subscribed handler", () => {
    const bus = new EventBus();
    const received: any[] = [];
    bus.subscribe("worker-1", (msg) => received.push(msg));

    const msg = createTestMessage({ to: "worker-1" });
    bus.publish(msg);

    expect(received).toHaveLength(1);
    expect(received[0].id).toBe(msg.id);
  });

  it("delivers broadcast to all except sender", () => {
    const bus = new EventBus();
    const received: any[] = [];
    bus.subscribe("worker-1", (msg) => received.push(msg));
    bus.subscribe("worker-2", (msg) => received.push(msg));

    const msg = createTestMessage({ from: "lead", to: "broadcast" });
    bus.publish(msg);

    expect(received).toHaveLength(2);
  });

  it("does not deliver to wrong actor", () => {
    const bus = new EventBus();
    const received: any[] = [];
    bus.subscribe("worker-2", (msg) => received.push(msg));

    bus.publish(createTestMessage({ to: "worker-1" }));
    expect(received).toHaveLength(0);
  });

  it("unsubscribe stops delivery", () => {
    const bus = new EventBus();
    const received: any[] = [];
    const unsub = bus.subscribe("worker-1", (msg) => received.push(msg));

    unsub();
    bus.publish(createTestMessage({ to: "worker-1" }));
    expect(received).toHaveLength(0);
  });

  it("getMessageLog returns all published messages", () => {
    const bus = new EventBus();
    bus.publish(createTestMessage());
    bus.publish(createTestMessage());
    expect(bus.getMessageLog()).toHaveLength(2);
  });

  it("supports multiple subscribers on same actor", () => {
    const bus = new EventBus();
    const received1: any[] = [];
    const received2: any[] = [];
    bus.subscribe("worker-1", (msg) => received1.push(msg));
    bus.subscribe("worker-1", (msg) => received2.push(msg));

    bus.publish(createTestMessage({ to: "worker-1" }));
    expect(received1).toHaveLength(1);
    expect(received2).toHaveLength(1);
  });
});
