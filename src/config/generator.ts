import { homedir } from "node:os";
import { join } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import { parseTeamConfig } from "@/config/parser.js";
import { DEFAULT_SETTINGS } from "@/types.js";

export interface GenerateTeamConfigInput {
  name: string;
  location: "project" | "global";
  lead: {
    role: string;
    model: string;
    system_prompt: string;
    tools: string[];
  };
  workers: Array<{
    role: string;
    model: string;
    system_prompt: string;
    tools: string[];
  }>;
  workflow?: string;
}

export const AVAILABLE_TOOLS = [
  "read_file",
  "write_file",
  "edit_file",
  "bash",
  "grep",
  "glob",
  "list_directory",
];

export const DEFAULT_MODEL = "claude-sonnet-4-20250514";

export function generateTeamYaml(input: GenerateTeamConfigInput): string {
  const config = {
    name: input.name,
    lead: {
      role: input.lead.role,
      model: input.lead.model,
      system_prompt: input.lead.system_prompt,
      tools: input.lead.tools,
    },
    workers: input.workers.map((w) => ({
      role: w.role,
      model: w.model,
      system_prompt: w.system_prompt,
      tools: w.tools,
    })),
    ...(input.workflow ? { workflow: input.workflow } : {}),
    settings: {
      busy_timeout_ms: DEFAULT_SETTINGS.busyTimeoutMs,
      snapshot_interval: DEFAULT_SETTINGS.snapshotInterval,
      max_retries: DEFAULT_SETTINGS.maxRetries,
      base_retry_delay_ms: DEFAULT_SETTINGS.baseRetryDelayMs,
    },
  };

  const yaml = stringifyYaml(config);

  parseTeamConfig(yaml);

  return yaml;
}

export function resolveConfigPath(
  teamName: string,
  location: "project" | "global",
  cwd: string,
): string {
  if (location === "project") {
    return join(cwd, `.pi/teams/${teamName}.yaml`);
  }
  return join(homedir(), `.pi/teams/${teamName}.yaml`);
}
