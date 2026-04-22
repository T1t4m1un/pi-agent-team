import { Agent, type AgentTool } from "@mariozechner/pi-agent-core";
import { streamSimple } from "@mariozechner/pi-ai";
import { ActorStateMachine } from "@/actor/state-machine.js";
import type { EventBus } from "@/messaging/event-bus.js";
import { JsonlInbox } from "@/messaging/jsonl-inbox.js";
import { createMessage } from "@/messaging/message.js";
import type { LLMScheduler } from "@/scheduler/llm-scheduler.js";
import type { ActorState, TeamMessage, TaskPayload, TaskResultPayload } from "@/types.js";

export interface TeamActorDeps {
  eventBus: EventBus;
  leadActorId: string;
  teamName: string;
  llmScheduler?: LLMScheduler;
}

export class TeamActor {
  readonly actorId: string;
  readonly role: string;
  private readonly model: string;
  private readonly agent: Agent;
  private readonly stateMachine: ActorStateMachine;
  private readonly deps: TeamActorDeps;
  private readonly inbox: JsonlInbox;
  private unsubscribe?: () => void;
  private currentTaskId?: string;
  private lastActivity: number;

  constructor(
    actorId: string,
    role: string,
    model: string,
    systemPrompt: string,
    tools: AgentTool<any>[],
    deps: TeamActorDeps,
    agentOptions?: Record<string, unknown>,
  ) {
    this.actorId = actorId;
    this.role = role;
    this.model = model;
    this.deps = deps;
    this.lastActivity = Date.now();
    this.stateMachine = new ActorStateMachine("created");
    this.inbox = new JsonlInbox(deps.teamName, actorId);

    this.agent = new Agent({
      initialState: {
        systemPrompt,
        model: undefined as any,
        tools,
      },
      streamFn: (model, context, options) => {
        if (deps.llmScheduler) {
          const acquire = deps.llmScheduler.acquire(actorId, model.id);
          const stream = streamSimple(model, context, options);
          stream.result().finally(() => {
            acquire.then(({ release }) => release());
          });
          return stream;
        }
        return streamSimple(model, context, options);
      },
      ...agentOptions,
    });
  }

  get state(): ActorState {
    return {
      actorId: this.actorId,
      role: this.role,
      model: this.model,
      currentState: this.stateMachine.state,
      currentTask: this.stateMachine.isBusy() ? this.currentTaskId : undefined,
      lastActivity: this.lastActivity,
    };
  }

  get isShutdown(): boolean {
    return this.stateMachine.isShutdown();
  }

  async init(): Promise<void> {
    this.stateMachine.transition("ready");

    this.unsubscribe = this.deps.eventBus.subscribe(this.actorId, (msg) => {
      this.handleMessage(msg).catch((err) => {
        console.error(`[TeamActor ${this.actorId}] Error handling message:`, err);
      });
    });

    const initMsg = createMessage(this.actorId, "broadcast", "status_update", {
      status: "ready",
      role: this.role,
    });
    await this.inbox.append({ direction: "out", message: initMsg });
  }

  private async handleMessage(msg: TeamMessage): Promise<void> {
    if (this.stateMachine.isShutdown()) return;

    await this.inbox.append({ direction: "in", message: msg });
    this.lastActivity = Date.now();

    switch (msg.type) {
      case "task_assign":
        await this.handleTaskAssign(msg);
        break;
      case "task_retry":
        await this.handleTaskAssign(msg);
        break;
      case "shutdown":
        await this.handleShutdown();
        break;
      case "timeout":
        break;
      default:
        break;
    }
  }

  private async handleTaskAssign(msg: TeamMessage): Promise<void> {
    if (!this.stateMachine.isReady() && !this.stateMachine.isError()) {
      const errMsg = createMessage(
        this.actorId,
        this.deps.leadActorId,
        "error",
        {
          error: `Actor ${this.actorId} not ready (state: ${this.stateMachine.state})`,
          actorId: this.actorId,
          recoverable: false,
        },
        { replyTo: msg.id },
      );
      this.deps.eventBus.publish(errMsg);
      await this.inbox.append({ direction: "out", message: errMsg });
      return;
    }

    this.stateMachine.transition("busy");
    this.currentTaskId = msg.id;
    const payload = msg.payload as TaskPayload;

    try {
      await this.agent.prompt(payload.task);

      const resultMsg = createMessage(
        this.actorId,
        this.deps.leadActorId,
        "task_result",
        {
          status: "success",
          result: "Task completed",
          actorId: this.actorId,
        } as TaskResultPayload,
        { replyTo: msg.id },
      );
      this.deps.eventBus.publish(resultMsg);
      await this.inbox.append({ direction: "out", message: resultMsg });

      this.stateMachine.transition("ready");
    } catch (err) {
      this.stateMachine.transition("error");

      const errMsg = createMessage(
        this.actorId,
        this.deps.leadActorId,
        "task_result",
        {
          status: "error",
          error: String(err),
          actorId: this.actorId,
        } as TaskResultPayload,
        { replyTo: msg.id },
      );
      this.deps.eventBus.publish(errMsg);
      await this.inbox.append({ direction: "out", message: errMsg });
    } finally {
      this.currentTaskId = undefined;
      this.lastActivity = Date.now();
    }
  }

  private async handleShutdown(): Promise<void> {
    if (this.stateMachine.isShutdown()) return;

    try {
      this.agent.abort();
    } catch {
      // abort may throw if agent not started
    }

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }

    if (!this.stateMachine.isShutdown()) {
      try {
        this.stateMachine.transition("shutdown");
      } catch {
        // already shutdown is fine
      }
    }
  }

  async shutdown(): Promise<void> {
    await this.handleShutdown();
  }

  async prompt(message: string): Promise<void> {
    await this.agent.prompt(message);
  }

  getAgent(): Agent {
    return this.agent;
  }
}
