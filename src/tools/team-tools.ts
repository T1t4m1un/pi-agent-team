import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type, type Static } from "@sinclair/typebox";

const AssignTaskParams = Type.Object({
  actorId: Type.String({ description: "The actorId of the worker to assign the task to" }),
  task: Type.String({ description: "Description of the task to assign" }),
  context: Type.Optional(Type.String({ description: "Additional context for the task" })),
});

const BroadcastParams = Type.Object({
  message: Type.String({ description: "Message to broadcast to all workers" }),
});

const MessageWorkerParams = Type.Object({
  actorId: Type.String({ description: "The actorId of the worker to message" }),
  message: Type.String({ description: "Message content" }),
});

const CollectResultsParams = Type.Object({
  actorIds: Type.Optional(
    Type.Array(Type.String({ description: "Worker actorIds to collect results from" }), {
      description: "Specific workers to collect from. If omitted, collects from all.",
    }),
  ),
});

const ListWorkersParams = Type.Object({});

const ShutdownTeamParams = Type.Object({});

export type AssignTaskArgs = Static<typeof AssignTaskParams>;
export type BroadcastArgs = Static<typeof BroadcastParams>;
export type MessageWorkerArgs = Static<typeof MessageWorkerParams>;
export type CollectResultsArgs = Static<typeof CollectResultsParams>;

export function createLeadTools(deps: {
  assignTask: (args: AssignTaskArgs) => Promise<string>;
  broadcast: (args: BroadcastArgs) => Promise<string>;
  messageWorker: (args: MessageWorkerArgs) => Promise<string>;
  collectResults: (args: CollectResultsArgs) => Promise<string>;
  listWorkers: () => Promise<string>;
  shutdownTeam: () => Promise<string>;
}): AgentTool<any>[] {
  return [
    {
      name: "assign_task",
      label: "Assign Task",
      description:
        "Assign a task to a specific worker. The worker will execute the task and return results.",
      parameters: AssignTaskParams,
      execute: async (_id, params) => {
        const result = await deps.assignTask(params);
        return { content: [{ type: "text" as const, text: result }], details: {} };
      },
    },
    {
      name: "broadcast",
      label: "Broadcast",
      description: "Send a message to all workers simultaneously.",
      parameters: BroadcastParams,
      execute: async (_id, params) => {
        const result = await deps.broadcast(params);
        return { content: [{ type: "text" as const, text: result }], details: {} };
      },
    },
    {
      name: "message_worker",
      label: "Message Worker",
      description: "Send a direct message to a specific worker.",
      parameters: MessageWorkerParams,
      execute: async (_id, params) => {
        const result = await deps.messageWorker(params);
        return { content: [{ type: "text" as const, text: result }], details: {} };
      },
    },
    {
      name: "collect_results",
      label: "Collect Results",
      description: "Collect pending results from workers. Waits for in-flight tasks if needed.",
      parameters: CollectResultsParams,
      execute: async (_id, params) => {
        const result = await deps.collectResults(params);
        return { content: [{ type: "text" as const, text: result }], details: {} };
      },
    },
    {
      name: "list_workers",
      label: "List Workers",
      description: "List all workers and their current states.",
      parameters: ListWorkersParams,
      execute: async () => {
        const result = await deps.listWorkers();
        return { content: [{ type: "text" as const, text: result }], details: {} };
      },
    },
    {
      name: "shutdown_team",
      label: "Shutdown Team",
      description: "Shut down the entire team. All workers will be stopped.",
      parameters: ShutdownTeamParams,
      execute: async () => {
        const result = await deps.shutdownTeam();
        return { content: [{ type: "text" as const, text: result }], details: {} };
      },
    },
  ];
}

const MessageLeadParams = Type.Object({
  type: Type.Union([Type.Literal("task_result"), Type.Literal("error"), Type.Literal("question")], {
    description: "Type of message to send to Lead",
  }),
  payload: Type.String({ description: "Message content or result data" }),
  replyTo: Type.Optional(Type.String({ description: "ID of the message this replies to" })),
});

export type MessageLeadArgs = Static<typeof MessageLeadParams>;

export function createWorkerMessageLeadTool(
  sendMessage: (args: MessageLeadArgs) => Promise<string>,
): AgentTool<any> {
  return {
    name: "message_lead",
    label: "Message Lead",
    description:
      "Send a message to the team Lead. Use for reporting task results, errors, or asking questions.",
    parameters: MessageLeadParams,
    execute: async (_id, params) => {
      const result = await sendMessage(params);
      return { content: [{ type: "text" as const, text: result }], details: {} };
    },
  };
}
