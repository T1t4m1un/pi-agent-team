import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  generateTeamYaml,
  resolveConfigPath,
  AVAILABLE_TOOLS,
  DEFAULT_MODEL,
  type GenerateTeamConfigInput,
} from "@/config/generator.js";

export const CUSTOM_OPTION = "✏️ 自定义...";

const LOCATION_OPTIONS = ["project (当前项目 .pi/teams/)", "global (~/.pi/teams/)"] as const;

const PRESET_WORKER_TEMPLATES: Record<
  string,
  Array<{ role: string; system_prompt: string; tools: string[] }>
> = {
  前后端开发: [
    {
      role: "backend",
      system_prompt: "你是一名后端开发工程师，负责 API 设计、数据库建模和业务逻辑实现。",
      tools: AVAILABLE_TOOLS,
    },
    {
      role: "frontend",
      system_prompt: "你是一名前端开发工程师，负责 UI 组件开发、页面交互和样式实现。",
      tools: AVAILABLE_TOOLS,
    },
  ],
  "开发+审查": [
    {
      role: "coder",
      system_prompt: "你是一名开发工程师，负责功能实现和代码编写。",
      tools: AVAILABLE_TOOLS,
    },
    {
      role: "reviewer",
      system_prompt: "你是一名代码审查员，负责审查代码质量、安全性和最佳实践。",
      tools: ["read_file", "grep", "glob", "list_directory"],
    },
  ],
  "全栈+测试": [
    {
      role: "developer",
      system_prompt: "你是一名全栈开发工程师，负责前后端功能实现。",
      tools: AVAILABLE_TOOLS,
    },
    {
      role: "tester",
      system_prompt: "你是一名测试工程师，负责编写单元测试和集成测试。",
      tools: AVAILABLE_TOOLS,
    },
  ],
};

const WORKFLOW_PRESETS: Record<string, string> = {
  顺序分工: "Lead 接收任务 → 分配给对应 Worker → Worker 完成 → Lead 收集结果 → 汇总输出",
  并行开发: "Lead 拆解任务 → 并行分配给所有 Worker → 各 Worker 独立完成 → Lead 合并结果",
  代码审查: "Lead 分配编码任务 → Coder 实现功能 → Reviewer 审查代码 → 反馈修改 → Lead 确认完成",
};

export interface TeamInitUI {
  select(
    title: string,
    options: string[],
    opts?: { timeout?: number },
  ): Promise<string | undefined>;
  input(
    title: string,
    placeholder?: string,
    opts?: { timeout?: number },
  ): Promise<string | undefined>;
  notify(message: string, type?: "info" | "error" | "warning"): void;
}

export async function runTeamInitWizard(args: string, ui: TeamInitUI, cwd: string): Promise<void> {
  const userHint = args.trim();

  const teamName = await askWithPreset(
    ui,
    "团队名称",
    userHint ? [userHint] : ["my-team"],
    "my-team",
  );
  if (!teamName) return;

  const locationRaw = await ui.select("配置存储位置", [...LOCATION_OPTIONS]);
  if (!locationRaw) return;
  const location: "project" | "global" = locationRaw.startsWith("project") ? "project" : "global";

  const leadRole = await askWithPreset(
    ui,
    "Lead 角色名",
    ["lead", "tech-lead", "architect"],
    "lead",
  );
  if (!leadRole) return;

  const leadPrompt = await askWithPreset(
    ui,
    "Lead 系统提示词",
    [
      `你是 ${teamName} 团队的技术负责人，负责理解用户需求、拆解任务、分配给成员并汇总结果。`,
      `你是 ${teamName} 团队的项目经理，负责协调团队成员完成开发任务。`,
    ],
    `你是 ${teamName} 团队的技术负责人，负责分配任务和汇总结果。`,
  );
  if (!leadPrompt) return;

  const workerTemplateKey = await ui.select("选择成员分工模板", [
    ...Object.keys(PRESET_WORKER_TEMPLATES),
    CUSTOM_OPTION,
  ]);
  if (!workerTemplateKey) return;

  let workers: GenerateTeamConfigInput["workers"];
  if (workerTemplateKey === CUSTOM_OPTION) {
    const custom = await collectCustomWorkers(ui);
    if (!custom || custom.length === 0) return;
    workers = custom;
  } else {
    workers = PRESET_WORKER_TEMPLATES[workerTemplateKey].map((w) => ({
      ...w,
      model: DEFAULT_MODEL,
    }));

    for (let i = 0; i < workers.length; i++) {
      const w = workers[i];
      const confirmedRole = await askWithPreset(ui, `Worker ${i + 1} 角色名`, [w.role], w.role);
      if (!confirmedRole) return;
      w.role = confirmedRole;

      const confirmedPrompt = await askWithPreset(
        ui,
        `Worker ${i + 1} 系统提示词`,
        [w.system_prompt],
        w.system_prompt,
      );
      if (!confirmedPrompt) return;
      w.system_prompt = confirmedPrompt;
    }
  }

  const workflowKey = await ui.select("选择工作流程", [
    ...Object.keys(WORKFLOW_PRESETS),
    CUSTOM_OPTION,
    "跳过",
  ]);
  if (!workflowKey) return;

  let workflow: string | undefined;
  if (workflowKey === CUSTOM_OPTION) {
    const custom = await ui.input(
      "请输入工作流描述",
      "Lead 接收任务 → 分配 Worker → 收集结果 → 汇总",
    );
    if (custom) workflow = custom;
  } else if (workflowKey !== "跳过") {
    workflow = WORKFLOW_PRESETS[workflowKey];
    const confirmed = await askWithPreset(ui, "工作流描述", [workflow], workflow);
    if (confirmed !== undefined) workflow = confirmed;
  }

  const input: GenerateTeamConfigInput = {
    name: teamName,
    location,
    lead: {
      role: leadRole,
      model: DEFAULT_MODEL,
      system_prompt: leadPrompt,
      tools: AVAILABLE_TOOLS,
    },
    workers,
    workflow,
  };

  try {
    const yaml = generateTeamYaml(input);
    const configPath = resolveConfigPath(input.name, input.location, cwd);

    await mkdir(dirname(configPath), { recursive: true });
    await writeFile(configPath, yaml, "utf-8");

    ui.notify(`配置文件已生成：${configPath}\n使用 /team ${input.name} 启动团队。`, "info");
  } catch (err) {
    ui.notify(`生成失败：${err instanceof Error ? err.message : String(err)}`, "error");
  }
}

async function askWithPreset(
  ui: TeamInitUI,
  title: string,
  presets: string[],
  fallback: string,
): Promise<string | undefined> {
  const choice = await ui.select(title, [...presets, CUSTOM_OPTION]);
  if (choice === undefined) return undefined;
  if (choice === CUSTOM_OPTION) {
    return ui.input(title, fallback);
  }
  return choice;
}

async function collectCustomWorkers(
  ui: TeamInitUI,
): Promise<GenerateTeamConfigInput["workers"] | undefined> {
  const workers: GenerateTeamConfigInput["workers"] = [];
  let addMore = true;

  while (addMore) {
    const role = await ui.input(
      `Worker ${workers.length + 1} 角色名`,
      `worker-${workers.length + 1}`,
    );
    if (!role) return undefined;

    const prompt = await ui.input(
      `Worker ${workers.length + 1} 系统提示词`,
      `你是一名${role}工程师，负责完成分配给你的任务。`,
    );
    if (!prompt) return undefined;

    workers.push({ role, model: DEFAULT_MODEL, system_prompt: prompt, tools: AVAILABLE_TOOLS });

    const more = await ui.select("继续添加 Worker？", ["是，继续添加", "否，已完成"]);
    addMore = more === "是，继续添加";
  }

  return workers;
}
