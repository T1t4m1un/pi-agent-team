## Why

单个 AI agent 在处理复杂产研任务时能力受限——无法同时扮演产品、开发、测试角色，也无法进行跨角色协作和互审。当前 Pi 生态缺少一个通用的多 agent 团队框架，支持并行执行和阶段化流程编排。产研测场景（PM→RD LD→RD→QA）是最典型的 use case，但框架需要通用化以支持任意团队配置。

## What Changes

- 新建 Pi Extension `@mariozechner/pi-agent-team`，提供 `/team` 命令启动 agent 团队
- 引入 Actor Model 架构：每个 agent 是一个 `TeamActor`（独立状态机、消息收发、工具沙箱）
- 引入独立编排 Lead 角色（不在 worker 中选 Lead，而是独立配置），由 Lead 智能驱动工作流（不硬编码流程引擎）
- `team.yaml` 声明式定义团队：角色、能力、工具、模型配置、流程描述（给 Lead 参考）
- EventBus + JSONL 双层消息系统：实时通信 + 持久化/crash recovery
- ToolScheduler：per-tool-type 队列 + 文件冲突检测（同文件串行、不同文件并行）
- LLMScheduler：per-model 并发控制 + pending queue + 429 retry
- TUI 进度面板展示团队状态

## Capabilities

### New Capabilities
- `actor-model`: TeamActor 生命周期管理、状态机（created→ready→busy→error→shutdown）、消息收发
- `team-orchestration`: Orchestrator（解析 team.yaml→创建 actors→启动 Lead→监控）+ Lead（智能编排，通过 system prompt + tools 驱动工作流）
- `messaging`: EventBus（in-memory 发布订阅）+ JSONL inbox（持久化、crash recovery、O(1) 追加）
- `tool-scheduler`: 共享工作工具的调度——per-tool-type 队列、文件冲突检测、并行/串行策略
- `llm-scheduler`: 多 model 并发控制、pending queue、429 retry、token/cost 追踪
- `team-config`: team.yaml 解析与校验——角色定义、工具映射、模型分配、流程描述
- `team-tui`: Pi Extension TUI 面板——actor 状态、任务进度、消息流、资源指标
- `team-recovery`: crash recovery——JSONL replay + state snapshot + 有序重启
- `team-testing`: 三层测试策略——单元测试（纯函数/状态机/scheduler）、集成测试（多 actor 协作/mock LLM）、冒烟测试（真实 LLM 端到端产研测流水线）

### Modified Capabilities

(none — 新项目)

## Impact

- **新 npm 包**: `pi-agent-team` extension，依赖 `pi-agent-core`（Layer 2 Agent class）
- **Extension API**: 注册 `/team` 和 `/team-recover` 命令，hook agent lifecycle 事件
- **文件系统**: `.pi/teams/` 目录存放 team.yaml 配置、JSONL 日志、state snapshot
- **运行时**: 单 Node.js 进程内多个 Agent 实例共享 EventBus 和 Scheduler
