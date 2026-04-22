import { describe, it, expect } from "vitest";
import { parseTeamConfig } from "@/config/parser.js";
import { extractWorkflowDescription, buildLeadSystemPrompt } from "@/config/workflow.js";

const WORKFLOW_YAML = `
name: flow-team
lead:
  role: lead
  model: claude-sonnet-4-20250514
  system_prompt: You coordinate the team.
workflow: |
  1. Lead assigns task
  2. Worker executes
workers:
  - role: worker
    model: claude-sonnet-4-20250514
    system_prompt: You do work.
`;

const MINIMAL_YAML = `
name: minimal-team
lead:
  role: lead
  model: claude-sonnet-4-20250514
  system_prompt: You coordinate.
workers:
  - role: worker
    model: claude-sonnet-4-20250514
    system_prompt: You do work.
`;

describe("extractWorkflowDescription", () => {
  it("extracts workflow from config", () => {
    const config = parseTeamConfig(WORKFLOW_YAML);
    const desc = extractWorkflowDescription(config);
    expect(desc).toContain("Lead assigns task");
  });

  it("returns empty string when no workflow", () => {
    const config = parseTeamConfig(MINIMAL_YAML);
    const desc = extractWorkflowDescription(config);
    expect(desc).toBe("");
  });
});

describe("buildLeadSystemPrompt", () => {
  it("builds prompt with worker roles", () => {
    const config = parseTeamConfig(MINIMAL_YAML);
    const prompt = buildLeadSystemPrompt("You are the lead.", config, ["worker"]);
    expect(prompt).toContain("You are the lead.");
    expect(prompt).toContain("worker");
  });
});
