import { describe, it, expect } from "vitest";
import { parse as parseYaml } from "yaml";
import { generateTeamYaml, resolveConfigPath, DEFAULT_MODEL } from "@/config/generator.js";
import type { GenerateTeamConfigInput } from "@/config/generator.js";
import { parseTeamConfig } from "@/config/parser.js";

const SAMPLE_INPUT: GenerateTeamConfigInput = {
  name: "test-team",
  location: "project",
  lead: {
    role: "lead",
    model: DEFAULT_MODEL,
    system_prompt: "你是技术负责人",
    tools: ["read_file", "write_file", "bash"],
  },
  workers: [
    {
      role: "coder",
      model: DEFAULT_MODEL,
      system_prompt: "你写代码",
      tools: ["read_file", "write_file", "edit_file", "bash"],
    },
  ],
};

describe("generateTeamYaml", () => {
  it("generates valid YAML that passes parseTeamConfig", () => {
    const yaml = generateTeamYaml(SAMPLE_INPUT);
    const config = parseTeamConfig(yaml);

    expect(config.name).toBe("test-team");
    expect(config.lead.role).toBe("lead");
    expect(config.workers).toHaveLength(1);
    expect(config.workers[0].role).toBe("coder");
  });

  it("includes workflow when provided", () => {
    const input: GenerateTeamConfigInput = {
      ...SAMPLE_INPUT,
      workflow: "lead 分配任务，coder 执行",
    };
    const yaml = generateTeamYaml(input);
    const config = parseTeamConfig(yaml);

    expect(config.workflow).toBe("lead 分配任务，coder 执行");
  });

  it("includes default settings", () => {
    const yaml = generateTeamYaml(SAMPLE_INPUT);
    const raw = parseYaml(yaml);

    expect(raw.settings.busy_timeout_ms).toBe(300000);
    expect(raw.settings.max_retries).toBe(3);
  });

  it("throws on invalid input (missing worker)", () => {
    const input = {
      ...SAMPLE_INPUT,
      workers: [],
    } as unknown as GenerateTeamConfigInput;

    expect(() => generateTeamYaml(input)).toThrow();
  });

  it("supports multiple workers", () => {
    const input: GenerateTeamConfigInput = {
      ...SAMPLE_INPUT,
      workers: [
        {
          role: "coder",
          model: DEFAULT_MODEL,
          system_prompt: "写代码",
          tools: ["read_file", "write_file"],
        },
        {
          role: "reviewer",
          model: DEFAULT_MODEL,
          system_prompt: "审查代码",
          tools: ["read_file", "grep"],
        },
      ],
    };
    const yaml = generateTeamYaml(input);
    const config = parseTeamConfig(yaml);

    expect(config.workers).toHaveLength(2);
    expect(config.workers.map((w) => w.role)).toEqual(["coder", "reviewer"]);
  });
});

describe("resolveConfigPath", () => {
  it("resolves project path", () => {
    const path = resolveConfigPath("my-team", "project", "/project");
    expect(path).toBe("/project/.pi/teams/my-team.yaml");
  });

  it("resolves global path", () => {
    const path = resolveConfigPath("my-team", "global", "/project");
    expect(path).toContain(".pi/teams/my-team.yaml");
    expect(path).not.toContain("/project");
  });
});
