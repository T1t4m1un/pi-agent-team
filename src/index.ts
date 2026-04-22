import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Orchestrator } from "@/orchestration/orchestrator.js";
import { SessionManifestManager } from "@/recovery/session-manifest.js";
import { createTeamInitTool, INIT_SYSTEM_PROMPT } from "@/tools/team-init-tools.js";
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
export { SessionManifestManager } from "@/recovery/session-manifest.js";
export { createLeadTools, createWorkerMessageLeadTool } from "@/tools/team-tools.js";
export { createTeamInitTool } from "@/tools/team-init-tools.js";
export { generateTeamYaml, resolveConfigPath } from "@/config/generator.js";
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

function createOrchestratorWithCallbacks(ctx: {
  ui: { notify: (msg: string, level?: "error" | "info" | "warning") => void };
}): Orchestrator {
  return new Orchestrator({
    onTeamStart: (info) => {
      ctx.ui.notify(`Team '${info.teamName}' started with ${info.actors.length} actors`, "info");
    },
    onTeamEnd: (summary: SessionCostSummary) => {
      ctx.ui.notify(`Team session ended. ${summary.taskStats.completed} tasks completed.`, "info");
      activeOrchestrator = null;
    },
    onActorStateChange: (info) => {
      ctx.ui.notify(`${info.actorId}: ${info.from} → ${info.to}`, "info");
    },
    onActorMessage: () => {},
  });
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("team", {
    description: "Start or recover a multi-agent team session (usage: /team <team-name> [task])",
    handler: async (args, ctx) => {
      const parts = args.trim().split(/\s+/);
      if (parts.length === 0 || !parts[0]) {
        ctx.ui.notify("Usage: /team <team-name> [task description]", "error");
        return;
      }

      const teamName = parts[0];
      const task = parts.slice(1).join(" ") || undefined;

      try {
        if (activeOrchestrator) {
          ctx.ui.notify("A team session is already active. Shut it down first.", "error");
          return;
        }

        const manifestManager = new SessionManifestManager(teamName);
        const existingManifest = await manifestManager.load();

        if (existingManifest && existingManifest.status === "active") {
          const orchestrator = createOrchestratorWithCallbacks(ctx);
          activeOrchestrator = orchestrator;

          const { pendingTasks, recoveredFrom } = await orchestrator.recover(teamName);

          ctx.ui.notify(
            `Recovered team '${teamName}' from ${recoveredFrom}. ${pendingTasks.length} pending task(s) resumed.`,
            "info",
          );

          if (task) {
            await orchestrator.getLeadActor().prompt(task);
          }
          return;
        }

        const yamlPath = await findTeamYaml(teamName, ctx.cwd);
        const orchestrator = createOrchestratorWithCallbacks(ctx);
        activeOrchestrator = orchestrator;
        await orchestrator.bootstrap(yamlPath, task);
      } catch (err) {
        ctx.ui.notify(`Team error: ${String(err)}`, "error");
        activeOrchestrator = null;
      }
    },
  });

  pi.registerCommand("team-init", {
    description: "交互式生成团队配置文件 (usage: /team-init [团队描述])",
    handler: async (args, ctx) => {
      const tool = createTeamInitTool(ctx.cwd, ctx.ui.notify.bind(ctx.ui));
      pi.registerTool(tool);

      const userDescription = args.trim() || "帮我创建一个新的团队配置";
      pi.sendUserMessage(`${INIT_SYSTEM_PROMPT}\n\n用户需求：${userDescription}`);
    },
  });
}
