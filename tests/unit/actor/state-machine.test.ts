import { describe, it, expect } from "vitest";
import { ActorStateMachine } from "@/actor/state-machine.js";

describe("ActorStateMachine", () => {
  it("starts in created state", () => {
    const sm = new ActorStateMachine();
    expect(sm.state).toBe("created");
  });

  it("transitions created → ready", () => {
    const sm = new ActorStateMachine();
    sm.transition("ready");
    expect(sm.state).toBe("ready");
    expect(sm.isReady()).toBe(true);
  });

  it("transitions created → ready → busy → ready", () => {
    const sm = new ActorStateMachine();
    sm.transition("ready");
    sm.transition("busy");
    expect(sm.isBusy()).toBe(true);
    sm.transition("ready");
    expect(sm.isReady()).toBe(true);
  });

  it("transitions busy → error → ready (recovery)", () => {
    const sm = new ActorStateMachine();
    sm.transition("ready");
    sm.transition("busy");
    sm.transition("error");
    expect(sm.isError()).toBe(true);
    sm.transition("ready");
    expect(sm.isReady()).toBe(true);
  });

  it("transitions to shutdown from ready", () => {
    const sm = new ActorStateMachine();
    sm.transition("ready");
    sm.transition("shutdown");
    expect(sm.isShutdown()).toBe(true);
  });

  it("transitions to shutdown from busy", () => {
    const sm = new ActorStateMachine();
    sm.transition("ready");
    sm.transition("busy");
    sm.transition("shutdown");
    expect(sm.isShutdown()).toBe(true);
  });

  it("transitions to shutdown from error", () => {
    const sm = new ActorStateMachine();
    sm.transition("ready");
    sm.transition("busy");
    sm.transition("error");
    sm.transition("shutdown");
    expect(sm.isShutdown()).toBe(true);
  });

  it("throws on invalid transition created → busy", () => {
    const sm = new ActorStateMachine();
    expect(() => sm.transition("busy")).toThrow();
  });

  it("throws on invalid transition ready → error", () => {
    const sm = new ActorStateMachine();
    sm.transition("ready");
    expect(() => sm.transition("error")).toThrow();
  });

  it("throws on transition from shutdown", () => {
    const sm = new ActorStateMachine();
    sm.transition("ready");
    sm.transition("shutdown");
    expect(() => sm.transition("ready")).toThrow();
  });

  it("canTransition returns true for valid transitions", () => {
    const sm = new ActorStateMachine();
    expect(sm.canTransition("ready")).toBe(true);
    expect(sm.canTransition("shutdown")).toBe(true);
    expect(sm.canTransition("busy")).toBe(false);
  });
});
