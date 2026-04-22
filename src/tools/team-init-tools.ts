import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Type, type Static } from "@sinclair/typebox";
import {
  generateTeamYaml,
  resolveConfigPath,
  AVAILABLE_TOOLS,
  DEFAULT_MODEL,
  type GenerateTeamConfigInput,
} from "@/config/generator.js";

const RoleSchema = Type.Object({
  role: Type.String({ description: "角色名称，如 lead、coder、reviewer" }),
  model: Type.String({
    description: `模型 ID，默认 ${DEFAULT_MODEL}`,
    default: DEFAULT_MODEL,
  }),
  system_prompt: Type.String({ description: "该角色的系统提示词" }),
  tools: Type.Array(Type.String({ description: "可用工具名称" }), {
    description: `可用工具：${AVAILABLE_TOOLS.join(", ")}`,
  }),
});

const GenerateTeamConfigParams = Type.Object({
  name: Type.String({ description: "团队名称，用于配置文件名和状态存储" }),
  location: Type.Union([Type.Literal("project"), Type.Literal("global")], {
    description: "配置存储位置：project 存在项目 .pi/teams/ 下，global 存在 ~/.pi/teams/ 下",
    default: "project",
  }),
  lead: RoleSchema,
  workers: Type.Array(RoleSchema, {
    description: "团队成员列表，每个成员有独立的角色、模型、提示词和工具",
  }),
  workflow: Type.Optional(
    Type.String({
      description: "可选的工作流描述，会注入 Lead 的系统提示，说明团队协作流程",
    }),
  ),
});

export type GenerateTeamConfigParams = Static<typeof GenerateTeamConfigParams>;

const INIT_SYSTEM_PROMPT = `你是团队配置助手。帮助用户创建 pi-agent-team 的团队配置文件。

你需要收集以下信息：
1. 团队名称
2. 配置存储位置（项目级 project 或全局 global）
3. Lead 角色（负责人）的职责、模型、系统提示词、工具
4. 各 Worker 的角色名、职责、模型、系统提示词、工具
5. 可选的工作流描述

可用工具列表：${AVAILABLE_TOOLS.join(", ")}

收集完毕后，调用 generate_team_config 工具生成配置文件。如果用户提供的信息不够完整，主动追问。`;

export function createTeamInitTool(
  cwd: string,
  notify: (msg: string, level?: "info" | "error" | "warning") => void,
): ToolDefinition<typeof GenerateTeamConfigParams> {
  return {
    name: "generate_team_config",
    label: "Generate Team Config",
    description:
      "根据收集到的团队信息生成 team.yaml 配置文件。先和用户对话收集团队名称、成员分工等信息，然后调用此工具生成文件。",
    parameters: GenerateTeamConfigParams,
    promptSnippet: "生成团队配置文件（team.yaml）",
    promptGuidelines: [
      "帮助用户创建团队配置时，先收集团队名称、成员角色、分工、工作流等信息",
      "收集完毕后调用 generate_team_config 工具生成配置文件",
    ],
    execute: async (_toolCallId, params, _signal, _onUpdate, _ctx) => {
      try {
        const input: GenerateTeamConfigInput = {
          name: params.name,
          location: params.location,
          lead: params.lead,
          workers: params.workers,
          workflow: params.workflow,
        };

        const yaml = generateTeamYaml(input);
        const configPath = resolveConfigPath(input.name, input.location, cwd);

        await mkdir(dirname(configPath), { recursive: true });
        await writeFile(configPath, yaml, "utf-8");

        const message = `配置文件已生成：${configPath}\n\n使用 /team ${input.name} 启动团队。`;

        notify(message, "info");

        return {
          content: [{ type: "text" as const, text: message }],
          details: { configPath },
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `生成失败：${errorMessage}` }],
          details: {},
          isError: true,
        };
      }
    },
  };
}

export { INIT_SYSTEM_PROMPT };
