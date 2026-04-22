import { createMockEventBus } from "@test/helpers/mocks.js";
import { describe, it, expect } from "vitest";
import { parseTeamConfig } from "@/config/parser.js";
import { buildLeadSystemPrompt } from "@/config/workflow.js";
import { createLeadTools, createWorkerMessageLeadTool } from "@/tools/team-tools.js";

describe("Config → Lead tools integration", () => {
  const yaml = `
name: test-team
lead:
  role: lead
  model: claude-sonnet-4-20250514
  system_prompt: You coordinate the team.
workers:
  - role: coder
    model: claude-sonnet-4-20250514
    system_prompt: You write code.
  - role: tester
    model: claude-sonnet-4-20250514
    system_prompt: You test code.
`;

  it("parses config and creates lead tools with correct worker list", () => {
    const config = parseTeamConfig(yaml);
    const mockBus = createMockEventBus();
    const tools = createLeadTools({
      eventBus: mockBus as any,
      workers: config.workers,
      teamName: config.name,
      leadActorId: "lead",
    });

    const names = tools.map((t) => t.name);
    expect(names).toContain("assign_task");
    expect(names).toContain("broadcast");
    expect(names).toContain("message_worker");
    expect(names).toContain("collect_results");
    expect(names).toContain("list_workers");
    expect(names).toContain("shutdown_team");
  });

  it("builds system prompt mentioning all workers", () => {
    const config = parseTeamConfig(yaml);
    const prompt = buildLeadSystemPrompt(
      config.lead.system_prompt ?? "",
      config,
      config.workers.map((w) => w.role),
    );

    expect(prompt).toContain("coder");
    expect(prompt).toContain("tester");
  });

  it("worker message_lead tool sends message", async () => {
    const sentMessages: any[] = [];
    const sendMessage = (msg: any) => {
      sentMessages.push(msg);
    };

    const tool = createWorkerMessageLeadTool(sendMessage);
    const result = await tool.execute("tc-1", {
      message: "Need help with task",
    } as any);

    expect(sentMessages).toHaveLength(1);
    expect(result.content.length).toBeGreaterThan(0);
  });
});
