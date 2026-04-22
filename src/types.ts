export type ActorStateName = "created" | "ready" | "busy" | "error" | "shutdown";

export interface ActorState {
  actorId: string;
  role: string;
  model: string;
  currentState: ActorStateName;
  currentTask?: string;
  error?: string;
  lastActivity: number;
}

export interface StateTransition {
  from: ActorStateName;
  to: ActorStateName;
}

export const VALID_TRANSITIONS: StateTransition[] = [
  { from: "created", to: "ready" },
  { from: "ready", to: "busy" },
  { from: "busy", to: "ready" },
  { from: "busy", to: "error" },
  { from: "error", to: "ready" },
  { from: "error", to: "shutdown" },
  { from: "ready", to: "shutdown" },
  { from: "busy", to: "shutdown" },
  { from: "created", to: "shutdown" },
];

export const MESSAGE_TYPES = [
  "task_assign",
  "task_result",
  "task_retry",
  "broadcast",
  "error",
  "question",
  "shutdown",
  "status_update",
  "timeout",
] as const;

export type MessageType = (typeof MESSAGE_TYPES)[number];

export interface TeamMessage {
  id: string;
  from: string;
  to: string;
  type: MessageType;
  payload: unknown;
  timestamp: string;
  replyTo?: string;
}

export type TaskStatus = "success" | "error" | "pending";

export interface TaskPayload {
  task: string;
  context?: string;
}

export interface TaskResultPayload {
  status: TaskStatus;
  result?: string;
  error?: string;
  actorId: string;
}

export interface ErrorPayload {
  error: string;
  actorId: string;
  recoverable: boolean;
}

export interface RoleConfig {
  role: string;
  model: string;
  system_prompt?: string;
  system_prompt_file?: string;
  tools?: string[];
}

export interface TeamConfig {
  name: string;
  lead: RoleConfig;
  workers: RoleConfig[];
  workflow?: string;
  settings?: TeamSettings;
}

export interface TeamSettings {
  busyTimeoutMs?: number;
  snapshotInterval?: number;
  modelConcurrency?: Record<string, number>;
  maxRetries?: number;
  baseRetryDelayMs?: number;
}

export const DEFAULT_SETTINGS: Required<TeamSettings> = {
  busyTimeoutMs: 300_000,
  snapshotInterval: 100,
  modelConcurrency: {},
  maxRetries: 3,
  baseRetryDelayMs: 1000,
};

export const SHARED_WORK_TOOLS = [
  "read_file",
  "write_file",
  "edit_file",
  "bash",
  "grep",
  "glob",
  "list_directory",
] as const;

export type SharedWorkTool = (typeof SHARED_WORK_TOOLS)[number];

export const LEAD_TOOL_NAMES = [
  "assign_task",
  "broadcast",
  "message_worker",
  "collect_results",
  "list_workers",
  "shutdown_team",
] as const;

export type LeadToolName = (typeof LEAD_TOOL_NAMES)[number];

export interface TokenUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface ActorTokenUsage {
  [model: string]: TokenUsage;
}

export interface SessionCostSummary {
  actors: Record<string, ActorTokenUsage>;
  durationMs: number;
  taskStats: { completed: number; failed: number; total: number };
}

export interface StateSnapshot {
  timestamp: string;
  teamName: string;
  configPath: string;
  actors: ActorState[];
  messageCount: number;
  inFlightTasks: Record<string, string>;
  leadTranscript: unknown[];
}
