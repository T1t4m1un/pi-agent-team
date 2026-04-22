import { parse as parseYaml } from "yaml";
import { DEFAULT_SETTINGS } from "@/types.js";
import type { TeamConfig, RoleConfig, TeamSettings } from "@/types.js";

export interface ParseError {
  field: string;
  message: string;
}

export function parseTeamConfig(yamlContent: string): TeamConfig {
  const raw = parseYaml(yamlContent);
  const errors: ParseError[] = [];

  if (!raw || typeof raw !== "object") {
    throw new Error("team.yaml must be a valid YAML object");
  }

  if (!raw.name || typeof raw.name !== "string") {
    errors.push({ field: "name", message: "Required field 'name' is missing or not a string" });
  }

  if (!raw.lead || typeof raw.lead !== "object") {
    errors.push({ field: "lead", message: "Required field 'lead' is missing or not an object" });
  } else {
    validateRoleConfig(raw.lead, "lead", errors);
  }

  if (!Array.isArray(raw.workers) || raw.workers.length === 0) {
    errors.push({ field: "workers", message: "Required field 'workers' is missing or empty" });
  } else {
    raw.workers.forEach((w: unknown, i: number) => {
      if (typeof w === "object" && w !== null) {
        validateRoleConfig(w as Record<string, unknown>, `workers[${i}]`, errors);
      } else {
        errors.push({ field: `workers[${i}]`, message: "Worker must be an object" });
      }
    });
  }

  if (errors.length > 0) {
    const messages = errors.map((e) => `  - ${e.field}: ${e.message}`).join("\n");
    throw new Error(`team.yaml validation errors:\n${messages}`);
  }

  const settings: TeamSettings = {
    busyTimeoutMs: raw.settings?.busy_timeout_ms ?? DEFAULT_SETTINGS.busyTimeoutMs,
    snapshotInterval: raw.settings?.snapshot_interval ?? DEFAULT_SETTINGS.snapshotInterval,
    modelConcurrency: raw.settings?.model_concurrency ?? {},
    maxRetries: raw.settings?.max_retries ?? DEFAULT_SETTINGS.maxRetries,
    baseRetryDelayMs: raw.settings?.base_retry_delay_ms ?? DEFAULT_SETTINGS.baseRetryDelayMs,
  };

  return {
    name: raw.name,
    lead: normalizeRoleConfig(raw.lead),
    workers: raw.workers.map(normalizeRoleConfig),
    workflow: raw.workflow ?? undefined,
    settings,
  };
}

function validateRoleConfig(
  role: Record<string, unknown>,
  path: string,
  errors: ParseError[],
): void {
  if (!role.role || typeof role.role !== "string") {
    errors.push({
      field: `${path}.role`,
      message: "Required field 'role' is missing or not a string",
    });
  }
  if (!role.model || typeof role.model !== "string") {
    errors.push({
      field: `${path}.model`,
      message: "Required field 'model' is missing or not a string",
    });
  }
  const hasPrompt = typeof role.system_prompt === "string";
  const hasPromptFile = typeof role.system_prompt_file === "string";
  if (!hasPrompt && !hasPromptFile) {
    errors.push({
      field: `${path}.system_prompt`,
      message: "Either 'system_prompt' or 'system_prompt_file' must be provided",
    });
  }
}

function normalizeRoleConfig(raw: Record<string, unknown>): RoleConfig {
  return {
    role: raw.role as string,
    model: raw.model as string,
    system_prompt: raw.system_prompt as string | undefined,
    system_prompt_file: raw.system_prompt_file as string | undefined,
    tools: Array.isArray(raw.tools) ? (raw.tools as string[]) : undefined,
  };
}
