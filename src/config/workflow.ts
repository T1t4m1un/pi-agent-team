import type { TeamConfig } from "@/types.js";

export function extractWorkflowDescription(config: TeamConfig): string {
  if (!config.workflow) return "";
  return ["## Team Workflow", "", config.workflow, ""].join("\n");
}

export function buildLeadSystemPrompt(
  basePrompt: string,
  config: TeamConfig,
  workerRoles: string[],
): string {
  const parts = [basePrompt];

  const workflow = extractWorkflowDescription(config);
  if (workflow) {
    parts.push(workflow);
  }

  parts.push("## Available Workers");
  parts.push("");
  for (const role of workerRoles) {
    parts.push(`- ${role}`);
  }
  parts.push("");

  return parts.join("\n");
}
