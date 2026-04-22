import { readFileSync } from "node:fs";
import { TeamActor } from "@/actor/team-actor.js";
import { parseTeamConfig } from "@/config/parser.js";
import { buildLeadSystemPrompt } from "@/config/workflow.js";
import { EventBus } from "@/messaging/event-bus.js";
import { createMessage } from "@/messaging/message.js";
import { SnapshotManager } from "@/recovery/snapshot.js";
import { LLMScheduler } from "@/scheduler/llm-scheduler.js";
import { ToolScheduler } from "@/scheduler/tool-scheduler.js";
import { createLeadTools, createWorkerMessageLeadTool } from "@/tools/team-tools.js";
import type {
  AssignTaskArgs,
  BroadcastArgs,
  MessageWorkerArgs,
  CollectResultsArgs,
  MessageLeadArgs,
} from "@/tools/team-tools.js";
import type { TeamConfig, ActorState, TeamMessage, SessionCostSummary } from "@/types.js";
import { DEFAULT_SETTINGS } from "@/types.js";

export interface OrchestratorEvents {
  onTeamStart: (info: { teamName: string; actors: string[] }) => void;
  onTeamEnd: (summary: SessionCostSummary) => void;
  onActorStateChange: (info: { actorId: string; from: string; to: string }) => void;
  onActorMessage: (message: TeamMessage) => void;
}

export class Orchestrator {
  private config!: TeamConfig;
  private eventBus!: EventBus;
  private toolScheduler!: ToolScheduler;
  private llmScheduler!: LLMScheduler;
  private leadActor!: TeamActor;
  private workers = new Map<string, TeamActor>();
  private pendingResults = new Map<string, TeamMessage[]>();
  private monitorTimer?: ReturnType<typeof setInterval>;
  private snapshotTimer?: ReturnType<typeof setInterval>;
  private messageCountSinceSnapshot = 0;
  private snapshotManager!: SnapshotManager;
  private events: OrchestratorEvents;
  private teamName!: string;
  private shuttingDown = false;
  private taskStats = { completed: 0, failed: 0, total: 0 };

  constructor(events?: Partial<OrchestratorEvents>) {
    this.events = {
      onTeamStart: events?.onTeamStart ?? (() => {}),
      onTeamEnd: events?.onTeamEnd ?? (() => {}),
      onActorStateChange: events?.onActorStateChange ?? (() => {}),
      onActorMessage: events?.onActorMessage ?? (() => {}),
    };
  }

  async bootstrap(yamlPath: string, userMessage?: string): Promise<void> {
    const content = readFileSync(yamlPath, "utf-8");
    this.config = parseTeamConfig(content);
    this.teamName = this.config.name;

    const settings = { ...DEFAULT_SETTINGS, ...this.config.settings };

    this.eventBus = new EventBus();
    this.toolScheduler = new ToolScheduler();
    this.llmScheduler = new LLMScheduler({
      modelConcurrency: settings.modelConcurrency,
      maxRetries: settings.maxRetries,
      baseRetryDelayMs: settings.baseRetryDelayMs,
    });
    this.snapshotManager = new SnapshotManager(this.teamName);

    this.eventBus.subscribe("__orchestrator__", (msg) => {
      this.events.onActorMessage(msg);
      this.messageCountSinceSnapshot++;

      if (msg.type === "task_result") {
        const payload = msg.payload as { status: string };
        if (payload.status === "success") this.taskStats.completed++;
        else if (payload.status === "error") this.taskStats.failed++;
      }
    });

    const workerRoles = this.config.workers.map((w) => w.role);
    const leadId = this.config.lead.role;

    const leadSystemPrompt = buildLeadSystemPrompt(
      this.getSystemPrompt(this.config.lead),
      this.config,
      workerRoles,
    );

    this.leadActor = await this.createLeadActor(leadId, leadSystemPrompt, workerRoles);

    for (const workerConfig of this.config.workers) {
      const worker = await this.createWorkerActor(workerConfig, leadId);
      this.workers.set(workerConfig.role, worker);
    }

    this.events.onTeamStart({
      teamName: this.teamName,
      actors: [leadId, ...workerRoles],
    });

    if (userMessage) {
      await this.leadActor.prompt(userMessage);
    }

    this.startMonitor(settings.busyTimeoutMs);
    this.startSnapshotTimer(settings.snapshotInterval);
  }

  private async createLeadActor(
    leadId: string,
    systemPrompt: string,
    _workerRoles: string[],
  ): Promise<TeamActor> {
    const deps = {
      eventBus: this.eventBus,
      leadActorId: leadId,
      teamName: this.teamName,
      llmScheduler: this.llmScheduler,
    };

    const leadTools = createLeadTools({
      assignTask: async (args: AssignTaskArgs) => {
        const worker = this.workers.get(args.actorId);
        if (!worker) return `Error: No worker with actorId '${args.actorId}'`;

        const msg = createMessage(leadId, args.actorId, "task_assign", {
          task: args.task,
          context: args.context,
        });
        this.eventBus.publish(msg);
        this.taskStats.total++;

        if (!this.pendingResults.has(args.actorId)) {
          this.pendingResults.set(args.actorId, []);
        }

        return `Task assigned to ${args.actorId}`;
      },

      broadcast: async (args: BroadcastArgs) => {
        const msg = createMessage(leadId, "broadcast", "broadcast", {
          message: args.message,
        });
        this.eventBus.broadcast(msg);
        return `Broadcast sent to all workers`;
      },

      messageWorker: async (args: MessageWorkerArgs) => {
        const msg = createMessage(leadId, args.actorId, "status_update", {
          message: args.message,
        });
        this.eventBus.publish(msg);
        return `Message sent to ${args.actorId}`;
      },

      collectResults: async (args: CollectResultsArgs) => {
        const targetIds = args.actorIds ?? [...this.workers.keys()];
        const results: string[] = [];

        for (const actorId of targetIds) {
          const worker = this.workers.get(actorId);
          if (worker) {
            const state = worker.state;
            results.push(`${actorId}: state=${state.currentState}`);
          }
        }

        return results.join("\n") || "No results collected";
      },

      listWorkers: async () => {
        const lines: string[] = [];
        for (const [id, worker] of this.workers) {
          const s = worker.state;
          lines.push(`- ${id}: state=${s.currentState}, role=${s.role}`);
        }
        return lines.join("\n") || "No workers";
      },

      shutdownTeam: async () => {
        await this.shutdown();
        return "Team shutdown initiated";
      },
    });

    const actor = new TeamActor(
      leadId,
      "lead",
      this.config.lead.model,
      systemPrompt,
      leadTools,
      deps,
    );
    await actor.init();
    return actor;
  }

  private async createWorkerActor(
    config: TeamConfig["workers"][0],
    leadId: string,
  ): Promise<TeamActor> {
    const deps = {
      eventBus: this.eventBus,
      leadActorId: leadId,
      teamName: this.teamName,
      llmScheduler: this.llmScheduler,
    };

    const messageLeadTool = createWorkerMessageLeadTool(async (args: MessageLeadArgs) => {
      const msg = createMessage(
        config.role,
        leadId,
        args.type as any,
        {
          type: args.type,
          content: args.payload,
        },
        { replyTo: args.replyTo },
      );
      this.eventBus.publish(msg);
      return `Message sent to Lead (${args.type})`;
    });

    const workerTools = [messageLeadTool];

    const systemPrompt = this.getSystemPrompt(config);

    const actor = new TeamActor(
      config.role,
      config.role,
      config.model,
      systemPrompt,
      workerTools,
      deps,
    );
    await actor.init();
    return actor;
  }

  private getSystemPrompt(roleConfig: TeamConfig["lead"] | TeamConfig["workers"][0]): string {
    if (roleConfig.system_prompt) return roleConfig.system_prompt;
    if (roleConfig.system_prompt_file) {
      try {
        return readFileSync(roleConfig.system_prompt_file, "utf-8");
      } catch {
        return "";
      }
    }
    return "";
  }

  private startMonitor(busyTimeoutMs: number): void {
    this.monitorTimer = setInterval(() => {
      for (const [id, worker] of this.workers) {
        const state = worker.state;
        if (state.currentState === "busy") {
          const elapsed = Date.now() - state.lastActivity;
          if (elapsed > busyTimeoutMs) {
            const timeoutMsg = createMessage("__orchestrator__", this.config.lead.role, "timeout", {
              actorId: id,
              elapsedMs: elapsed,
            });
            this.eventBus.publish(timeoutMsg);
          }
        }
      }
    }, 10_000);
  }

  private startSnapshotTimer(interval: number): void {
    this.snapshotTimer = setInterval(async () => {
      if (this.messageCountSinceSnapshot >= interval) {
        await this.takeSnapshot();
      }
    }, 5_000);
  }

  private async takeSnapshot(): Promise<void> {
    const actors: ActorState[] = [
      this.leadActor.state,
      ...[...this.workers.values()].map((w) => w.state),
    ];

    const snapshot = {
      timestamp: new Date().toISOString(),
      teamName: this.teamName,
      actors,
      messageCount: this.eventBus.getMessageCount(),
      inFlightTasks: Object.fromEntries(
        [...this.workers.entries()]
          .filter(([, w]) => w.state.currentState === "busy")
          .map(([id, w]) => [id, w.state.currentTask ?? "unknown"]),
      ),
    };

    await this.snapshotManager.save(snapshot as any);
    this.messageCountSinceSnapshot = 0;
  }

  async shutdown(): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;

    if (this.monitorTimer) clearInterval(this.monitorTimer);
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);

    await this.takeSnapshot();

    for (const worker of this.workers.values()) {
      await worker.shutdown();
    }
    await this.leadActor.shutdown();

    this.eventBus.unsubscribeAll();

    const summary = this.llmScheduler.getSessionSummary(this.taskStats);
    this.events.onTeamEnd(summary);
  }

  getActorStates(): ActorState[] {
    return [this.leadActor.state, ...[...this.workers.values()].map((w) => w.state)];
  }

  getLLMScheduler(): LLMScheduler {
    return this.llmScheduler;
  }

  getToolScheduler(): ToolScheduler {
    return this.toolScheduler;
  }

  getEventBus(): EventBus {
    return this.eventBus;
  }

  getTeamName(): string {
    return this.teamName;
  }
}
