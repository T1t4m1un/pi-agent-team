import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DEFAULT_MODEL } from "@/config/generator.js";
import { createTeamInitTool } from "@/tools/team-init-tools.js";
import { createTeamInitTool } from "@/tools/team-init-tools.js";

describe("createTeamInitTool", () => {
  let tempDir: string;
  const notifications: Array<{ msg: string; level?: string }> = [];
  const mockNotify = (msg: string, level?: "info" | "error" | "warning") => {
    notifications.push({ msg, level });
  };

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "team-init-test-"));
    notifications.length = 0;
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("creates a tool with correct name and description", () => {
    const tool = createTeamInitTool(tempDir, mockNotify);
    expect(tool.name).toBe("generate_team_config");
    expect(tool.description).toContain("team.yaml");
    expect(tool.parameters).toBeDefined();
  });

  it("generates and writes config file", async () => {
    const tool = createTeamInitTool(tempDir, mockNotify);
    const result = await tool.execute(
      "call-1",
      {
        name: "init-test-team",
        location: "project",
        lead: {
          role: "lead",
          model: DEFAULT_MODEL,
          system_prompt: "你是负责人",
          tools: ["read_file", "write_file"],
        },
        workers: [
          {
            role: "coder",
            model: DEFAULT_MODEL,
            system_prompt: "你写代码",
            tools: ["read_file", "write_file", "bash"],
          },
        ],
      },
      undefined,
      undefined,
      {} as any,
    );

    expect(result.isError).toBeFalsy();
    const textContent = result.content[0];
    expect(textContent.type).toBe("text");
    if (textContent.type === "text") {
      expect(textContent.text).toContain("配置文件已生成");
    }

    const writtenYaml = await readFile(join(tempDir, ".pi/teams/init-test-team.yaml"), "utf-8");
    expect(writtenYaml).toContain("init-test-team");
    expect(writtenYaml).toContain("coder");
  });

  it("returns error on invalid config", async () => {
    const tool = createTeamInitTool(tempDir, mockNotify);
    const result = await tool.execute(
      "call-2",
      {
        name: "bad-team",
        location: "project",
        lead: {
          role: "lead",
          model: DEFAULT_MODEL,
          system_prompt: "负责人",
          tools: ["read_file"],
        },
        workers: [],
      },
      undefined,
      undefined,
      {} as any,
    );

    expect(result.isError).toBe(true);
  });
});
