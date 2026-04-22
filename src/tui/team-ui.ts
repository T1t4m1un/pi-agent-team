import type { Orchestrator, OrchestratorEvents } from "@/orchestration/orchestrator.js";

export interface TeamUIState {
  actors: { id: string; role: string; state: string; task?: string }[];
  messageLog: { from: string; to: string; type: string; summary: string }[];
  metrics: {
    activeLLMCalls: number;
    schedulerQueueDepth: number;
    tokenUsage: Record<string, { input: number; output: number }>;
  };
}

export function createOrchestratorEvents(): {
  events: OrchestratorEvents;
  getUIState: (orchestrator: Orchestrator) => TeamUIState;
} {
  const messageLog: TeamUIState["messageLog"] = [];

  return {
    events: {
      onTeamStart: (info) => {
        console.log(`[Team] Started: ${info.teamName} with actors: ${info.actors.join(", ")}`);
      },
      onTeamEnd: (summary) => {
        console.log(`[Team] Session ended. Duration: ${(summary.durationMs / 1000).toFixed(1)}s`);
        console.log(
          `[Team] Tasks: ${summary.taskStats.completed} completed, ${summary.taskStats.failed} failed`,
        );
      },
      onActorStateChange: (info) => {
        console.log(`[Actor] ${info.actorId}: ${info.from} → ${info.to}`);
      },
      onActorMessage: (msg) => {
        const summary =
          typeof msg.payload === "object" && msg.payload !== null
            ? JSON.stringify(msg.payload).slice(0, 80)
            : String(msg.payload).slice(0, 80);
        messageLog.push({
          from: msg.from,
          to: msg.to,
          type: msg.type,
          summary,
        });
        if (messageLog.length > 100) messageLog.shift();
      },
    },
    getUIState: (orchestrator) => ({
      actors: orchestrator.getActorStates().map((s) => ({
        id: s.actorId,
        role: s.role,
        state: s.currentState,
        task: s.currentTask,
      })),
      messageLog: [...messageLog],
      metrics: {
        activeLLMCalls: orchestrator.getLLMScheduler().getActiveCalls(),
        schedulerQueueDepth: orchestrator.getToolScheduler().getQueueDepth(),
        tokenUsage: {},
      },
    }),
  };
}
