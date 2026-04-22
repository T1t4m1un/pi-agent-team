import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runTeamInitWizard, CUSTOM_OPTION } from "@/tools/team-init-tools.js";
import type { TeamInitUI } from "@/tools/team-init-tools.js";

function createMockUI(responses: { select: string[]; input: string[] }): TeamInitUI {
  let selectIdx = 0;
  let inputIdx = 0;
  const notifications: Array<{ msg: string; type?: string }> = [];

  return {
    select: vi.fn(async (_title: string, _options: string[]) => {
      return responses.select[selectIdx++] ?? undefined;
    }),
    input: vi.fn(async (_title: string, _placeholder?: string) => {
      return responses.input[inputIdx++] ?? undefined;
    }),
    notify: vi.fn((msg: string, type?: "info" | "error" | "warning") => {
      notifications.push({ msg, type });
    }),
  };
}

describe("runTeamInitWizard", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "team-init-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("completes full wizard with preset template and generates config", async () => {
    const ui = createMockUI({
      select: [
        "my-team",
        "project (当前项目 .pi/teams/)",
        "lead",
        `你是 my-team 团队的技术负责人，负责理解用户需求、拆解任务、分配给成员并汇总结果。`,
        "前后端开发",
        "backend",
        "你是一名后端开发工程师，负责 API 设计、数据库建模和业务逻辑实现。",
        "frontend",
        "你是一名前端开发工程师，负责 UI 组件开发、页面交互和样式实现。",
        "顺序分工",
        "Lead 接收任务 → 分配给对应 Worker → Worker 完成 → Lead 收集结果 → 汇总输出",
      ],
      input: [],
    });

    await runTeamInitWizard("", ui, tempDir);

    const configPath = join(tempDir, ".pi/teams/my-team.yaml");
    const yaml = await readFile(configPath, "utf-8");
    expect(yaml).toContain("my-team");
    expect(yaml).toContain("backend");
    expect(yaml).toContain("frontend");
    expect(yaml).toContain("workflow:");
    expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining("配置文件已生成"), "info");
  });

  it("uses custom workers when user selects custom option", async () => {
    const ui = createMockUI({
      select: [
        "custom-team",
        "global (~/.pi/teams/)",
        "architect",
        `你是 custom-team 团队的技术负责人`,
        CUSTOM_OPTION,
        "否，已完成",
        "跳过",
      ],
      input: ["custom-worker-1", "你是一名自定义工程师"],
    });

    const homeBackup = process.env.HOME;
    const homeDir = await mkdtemp(join(tmpdir(), "home-"));
    process.env.HOME = homeDir;

    try {
      await runTeamInitWizard("", ui, tempDir);

      const configPath = join(homeDir, ".pi/teams/custom-team.yaml");
      const yaml = await readFile(configPath, "utf-8");
      expect(yaml).toContain("custom-team");
      expect(yaml).toContain("custom-worker-1");
      expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining("配置文件已生成"), "info");
    } finally {
      process.env.HOME = homeBackup;
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  it("aborts when user cancels at first select", async () => {
    const ui = createMockUI({ select: [undefined], input: [] });

    await runTeamInitWizard("", ui, tempDir);

    expect(ui.notify).not.toHaveBeenCalled();
  });

  it("handles generation error gracefully", async () => {
    const ui = createMockUI({ select: [undefined], input: [] });

    await runTeamInitWizard("", ui, "/nonexistent/path/that/should/not/exist");

    expect(ui.notify).not.toHaveBeenCalled();
  });
});
