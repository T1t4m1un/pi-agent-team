import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Orchestrator } from "@/orchestration/orchestrator.js";
import { SnapshotManager } from "@/recovery/snapshot.js";
import type { SessionCostSummary } from "@/types.js";

export { ActorStateMachine } from "@/actor/state-machine.js";
export { InvalidTransitionError } from "@/actor/state-machine.js";
export { TeamActor } from "@/actor/team-actor.js";
export { EventBus } from "@/messaging/event-bus.js";
export { createMessage, validateMessage } from "@/messaging/message.js";
export { JsonlInbox } from "@/messaging/jsonl-inbox.js";
export { ToolScheduler } from "@/scheduler/tool-scheduler.js";
export { LLMScheduler } from "@/scheduler/llm-scheduler.js";
export { Orchestrator } from "@/orchestration/orchestrator.js";
export { parseTeamConfig } from "@/config/parser.js";
export { SnapshotManager, replayJsonlInboxes } from "@/recovery/snapshot.js";
export { createLeadTools, createWorkerMessageLeadTool } from "@/tools/team-tools.js";
export { buildLeadSystemPrompt } from "@/config/workflow.js";
export type * from "@/types.js";

let activeOrchestrator: Orchestrator | null = null;

async function findTeamYaml(teamName: string, cwd: string): Promise<string> {
  const candidates = [
    resolve(cwd, `.pi/teams/${teamName}.yaml`),
    resolve(cwd, `.pi/teams/${teamName}.yml`),
    resolve(cwd, `teams/${teamName}.yaml`),
    resolve(cwd, `teams/${teamName}.yml`),
    resolve(cwd, `${teamName}.yaml`),
    resolve(cwd, `${teamName}.yml`),
  ];

  for (const path of candidates) {
    if (existsSync(path)) return path;
  }

  throw new Error(
    `Team config not found for '${teamName}'. Searched:\n${candidates.map((p) => `  - ${p}`).join("\n")}`,
  );
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("team", {
    description: "Start a multi-agent team session (usage: /team <team-name> [task])",
    handler: async (args, ctx) => {
      const parts = args.trim().split(/\s+/);
      if (parts.length === 0 || !parts[0]) {
        ctx.ui.notify("Usage: /team <team-name> [task description]", "error");
        return;
      }

      const teamName = parts[0];
      const task = parts.slice(1).join(" ") || undefined;

      try {
        const yamlPath = await findTeamYaml(teamName, ctx.cwd);

        if (activeOrchestrator) {
          ctx.ui.notify("A team session is already active. Shut it down first.", "error");
          return;
        }

        const orchestrator = new Orchestrator({
          onTeamStart: (info) => {
            ctx.ui.notify(
              `Team '${info.teamName}' started with ${info.actors.length} actors`,
              "info",
            );
          },
          onTeamEnd: (summary: SessionCostSummary) => {
            ctx.ui.notify(
              `Team session ended. ${summary.taskStats.completed} tasks completed.`,
              "info",
            );
            activeOrchestrator = null;
          },
          onActorStateChange: (info) => {
            ctx.ui.notify(`${info.actorId}: ${info.from} → ${info.to}`, "info");
          },
          onActorMessage: () => {},
        });

        activeOrchestrator = orchestrator;
        await orchestrator.bootstrap(yamlPath, task);
      } catch (err) {
        ctx.ui.notify(`Team error: ${String(err)}`, "error");
        activeOrchestrator = null;
      }
    },
  });

  pi.registerCommand("team-recover", {
    description: "Recover a team session from crash (usage: /team-recover <team-name>)",
    handler: async (args, ctx) => {
      const teamName = args.trim();
      if (!teamName) {
        ctx.ui.notify("Usage: /team-recover <team-name>", "error");
        return;
      }

      try {
        const yamlPath = await findTeamYaml(teamName, ctx.cwd);
        const snapshotManager = new SnapshotManager(teamName);
        const snapshot = await snapshotManager.loadLatest();

        if (!snapshot) {
          ctx.ui.notify(`No snapshot found for team '${teamName}'. Starting fresh.`, "info");
        }

        const orchestrator = new Orchestrator({
          onTeamStart: (info) => {
            ctx.ui.notify(`Team '${info.teamName}' recovered`, "info");
          },
          onTeamEnd: (summary: SessionCostSummary) => {
            ctx.ui.notify(
              `Team session ended. ${summary.taskStats.completed} tasks completed.`,
              "info",
            );
            activeOrchestrator = null;
          },
        });

        activeOrchestrator = orchestrator;
        await orchestrator.bootstrap(yamlPath);

        ctx.ui.notify(
          snapshot
            ? `Recovered from snapshot at ${snapshot.timestamp}`
            : "No snapshot found, started fresh session",
          "info",
        );
      } catch (err) {
        ctx.ui.notify(`Recovery error: ${String(err)}`, "error");
        activeOrchestrator = null;
      }
    },
  });
}
