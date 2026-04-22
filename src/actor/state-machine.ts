import { VALID_TRANSITIONS } from "@/types.js";
import type { ActorStateName, StateTransition } from "@/types.js";

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: ActorStateName,
    public readonly to: ActorStateName,
  ) {
    super(`Invalid state transition: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

const VALID_TRANSITION_SET = new Set(
  VALID_TRANSITIONS.map((t: StateTransition) => `${t.from}->${t.to}`),
);

export class ActorStateMachine {
  private _state: ActorStateName;

  constructor(initial: ActorStateName = "created") {
    this._state = initial;
  }

  get state(): ActorStateName {
    return this._state;
  }

  canTransition(to: ActorStateName): boolean {
    return VALID_TRANSITION_SET.has(`${this._state}->${to}`);
  }

  transition(to: ActorStateName): void {
    if (!this.canTransition(to)) {
      throw new InvalidTransitionError(this._state, to);
    }
    this._state = to;
  }

  isShutdown(): boolean {
    return this._state === "shutdown";
  }

  isBusy(): boolean {
    return this._state === "busy";
  }

  isReady(): boolean {
    return this._state === "ready";
  }

  isError(): boolean {
    return this._state === "error";
  }
}
