# pi-agent-team

[Pi Coding Agent](https://github.com/badlogic/pi-mono) 的多智能体团队框架。通过 YAML 声明式定义一组 AI Agent，每个 Agent 拥有独立的角色、模型和工具。Lead Agent 负责分解任务、分配工作、收集结果，Worker Agent 各司其职——全程通过工具调用完成协作。

## 工作原理

1. **定义团队** — 在 `team.yaml` 中声明 Lead + Workers，各配角色/模型/系统提示/工具
2. **启动任务** — 在 Pi 中执行 `/team <team-name> "你的需求"`，扩展自动启动 Lead，Lead 分解任务并分配给 Worker
3. **崩溃恢复** — 再次执行 `/team <team-name>` 即可自动恢复：框架检测到未完成的会话后，通过 JSONL 日志回放 + 状态快照恢复，并自动续跑中断的任务

## 架构

- **Actor 模型** — 每个 Agent 是一个 `TeamActor`，封装 `pi-agent-core` Agent 并维护状态机（`created → ready → busy → error → shutdown`）
- **EventBus** — 进程内发布/订阅，负责 Agent 间消息路由
- **ToolScheduler** — 按工具类型维护 FIFO 队列，检测文件冲突（同文件写串行化、读写互斥）
- **LLMScheduler** — 按模型控制并发、429 自动重试（指数退避 + 抖动 + Retry-After）、Token 用量追踪
- **JSONL Inbox** — 持久化消息日志，用于崩溃恢复
- **SessionManifest** — 会话清单（`session.json`），跟踪会话状态（active/completed），启动时自动检测未完成的会话并触发恢复

## 快速开始

### 1. 创建 `team.yaml`

```yaml
name: dev-team
lead:
  role: lead
  model: claude-sonnet-4-20250514
  system_prompt: |
    你是技术负责人，负责拆解任务并分配给团队成员。
  tools:
    - read_file
    - write_file
    - bash

workers:
  - role: coder
    model: claude-sonnet-4-20250514
    system_prompt: 你写干净、经过测试的代码。
    tools:
      - read_file
      - write_file
      - edit_file
      - bash

  - role: reviewer
    model: claude-sonnet-4-20250514
    system_prompt: 你审查代码的质量和正确性。
    tools:
      - read_file

settings:
  busyTimeoutMs: 300000
  modelConcurrency:
    claude-sonnet-4-20250514: 3
```

### 2. 安装为 Pi 扩展

在项目的 `package.json` 中添加：

```json
{
  "pi": {
    "extensions": ["./node_modules/pi-agent-team/dist/index.js"]
  }
}
```

或放入 `.pi/extensions/` 目录。

### 3. 运行

在 Pi 中：

```
/team dev-team 添加 JWT 用户认证功能
```

崩溃恢复 — 如果上次会话中断，再次执行同一命令即可自动恢复：

```
/team dev-team
```

## 命令

| 命令 | 说明 |
|------|------|
| `/team <team-name> [任务]` | 启动或恢复团队会话；若存在未完成的会话则自动恢复 |

## 配置

### `team.yaml` 字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | 是 | 团队名称，用于状态持久化路径 |
| `lead` | 是 | Lead Agent 配置（role, model, system_prompt, tools） |
| `workers` | 是 | Worker Agent 配置数组 |
| `workflow` | 否 | 工作流描述，会注入 Lead 的系统提示 |
| `settings` | 否 | 团队运行参数 |

### 运行参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `busyTimeoutMs` | 300000 | Actor 忙碌超时（毫秒），超时标记为 error |
| `snapshotInterval` | 100 | 每处理 N 条消息保存一次状态快照 |
| `modelConcurrency` | {} | 按模型设置最大并发请求数（默认 5） |
| `maxRetries` | 3 | 429 错误最大重试次数 |
| `baseRetryDelayMs` | 1000 | 指数退避基础延迟（毫秒） |

## Lead 工具

Lead Agent 自动获得以下协调工具：

| 工具 | 说明 |
|------|------|
| `assign_task` | 给指定 Worker 分配任务 |
| `broadcast` | 向所有 Worker 广播消息 |
| `message_worker` | 向单个 Worker 发送消息 |
| `collect_results` | 收集 Worker 的任务结果 |
| `list_workers` | 列出所有可用 Worker |
| `shutdown_team` | 关闭整个团队 |

Worker 自动获得 `message_lead` 工具，用于向 Lead 发送消息。

## 开发

```bash
pnpm install        # 安装依赖
pnpm run build      # 编译 TypeScript
pnpm test           # 运行单元 + 集成测试
pnpm run test:unit  # 仅运行单元测试
pnpm run lint       # ESLint 检查
pnpm run format     # Prettier 格式化
pnpm run check      # 完整检查（类型 + lint + 格式 + 测试）
```

## 项目结构

```
src/
├── actor/          # TeamActor + 状态机
├── messaging/      # EventBus、消息协议、JSONL 持久化
├── scheduler/      # ToolScheduler、LLMScheduler
├── config/         # YAML 解析、工作流提取、系统提示构建
├── tools/          # Lead/Worker 工具定义（TypeBox Schema）
├── orchestration/  # Orchestrator 编排器
├── recovery/       # 快照管理、会话清单、JSONL 回放
├── tui/            # TUI 事件桥接
└── index.ts        # 扩展入口，注册 /team 命令（含自动恢复）
```

## 许可证

ISC
