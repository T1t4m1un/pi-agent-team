## Context

Pi Coding Agent 是一个极简终端 AI coding harness，设计哲学是"aggressively extensible"——核心不内置任何高级功能，全部通过 TypeScript extension 构建。社区已有多个多 agent 扩展（pi-messenger、pi-subagents、pi-collaborating-agents），但缺少一个通用的、支持流程编排的团队框架。

当前 Pi SDK 提供三层架构：`pi-ai`（LLM 接口）→ `pi-agent-core`（Agent class / agentLoop）→ `pi-coding-agent`（完整会话）。每层都是独立的 npm 包。`pi-agent-core` 的 `Agent` class 是完全独立的——独立状态、工具、消息历史、事件流——天然适合作为多 agent 构建基础。

核心 use case 是产研测流水线：PM 对齐需求 → RD LD 评估可行性 → RD 编码 → QA 测试，每阶段有审批门控。但框架需通用化，支持任意团队配置。

## Goals / Non-Goals

**Goals:**
- 通用 agent team 框架，支持并行执行和阶段化流程编排
- Actor Model 架构：每个 agent 独立状态机、消息收发、工具沙箱
- team.yaml 声明式配置团队（角色、工具、模型、流程描述）
- 独立编排 Lead 智能驱动工作流（非硬编码流程引擎）
- Crash recovery 通过 JSONL 持久化
- 作为 Pi Extension 分发，通过 `/team` 命令使用

**Non-Goals:**
- 不构建硬编码的 WorkflowEngine/Stage/Gate 类——流程由 Lead 智能编排
- 不构建跨进程 agent 分布式——单 Node.js 进程
- 不构建 agent 自定义创建/销毁——团队配置静态，由 team.yaml 定义
- 不构建 UI 交互界面——仅 TUI 进度面板
- 不构建 MCP 集成或外部工具协议
- 不构建 agent 学习/记忆跨会话持久化（首版）

## Decisions

### D1: Actor Model 统一架构

**决策**: Lead 和 Worker 使用同一个 `TeamActor` class，通过 system prompt + tool set 差异化。

**理由**: 统一代码路径减少维护负担。差异仅在配置层面（system prompt 定义角色行为，tool set 定义能力边界）。社区扩展 pi-subagents 证明了这种模式可行。

**备选**: Lead 和 Worker 用不同 class。被否决——增加代码复杂度，且 Lead 本质上也是一个有特殊工具的 agent。

### D2: 编排 Lead 独立于 Worker

**决策**: Lead 是独立角色，不是从 worker 中选出的。Orchestrator 解析 team.yaml 后创建 Lead，Lead 接管编排。

**理由**: 产研测场景中，RD LD 虽有技术决策权但不适合当全局编排者。独立 Lead 可以公正地管理冲突（如 QA 打回 RD 代码）。Lead 不参与具体业务工作，只做任务分配和流程管理。

### D3: 工作流由 Lead 智能驱动，非代码硬编码

**决策**: team.yaml 中的 workflow 部分是描述性的（给 Lead 参考），不生成 WorkflowEngine 实例。Lead 通过 system prompt 理解流程，用 tools（assign_task, collect_results, broadcast）执行。

**理由**: 用户明确要求"工作流能力交给 team lead"。硬编码流程引擎限制了灵活性——Lead 无法处理异常流程（如打回、并行审批、条件分支）。LLM 天然擅长理解和执行描述性流程。

**风险**: Lead 可能偏离预设流程。缓解：workflow 描述要清晰且包含门控规则；可后续增加 workflow validation（检查 Lead 行为是否符合预期阶段）。

### D4: EventBus + JSONL 双层消息

**决策**: EventBus（in-memory 发布订阅）用于实时通信，JSONL inbox 文件用于持久化。

**理由**: Pi 的 Agent 是事件驱动的（subscribe/listen 模式），EventBus 天然适配。JSONL 解决 crash recovery——O(1) 追加写入，启动时 replay 恢复状态。双层设计分离了实时性和持久化关注点。

**备选**: 仅用 JSONL 文件轮询（Claude Code 方案）。被否决——O(N) 读取性能差，轮询延迟高。仅用 EventBus 也不行——进程崩溃即丢失。

### D5: ToolScheduler 文件冲突检测

**决策**: 共享工作工具（read_file, write_file, edit_file, bash, grep, glob）通过 ToolScheduler 统一调度。同文件操作串行，不同文件操作并行。

**理由**: 多 agent 并发编辑同一文件必然冲突。per-tool-type 队列保证同一类型工具按 FIFO 执行，文件冲突检测在此基础上进一步约束同文件操作。

### D6: LLMScheduler per-model 并发控制

**决策**: 每个模型有独立并发计数器。超出并发限制的请求进入 pending queue，遇 429 自动 retry。

**理由**: 不同 provider 有不同 rate limit（Anthropic 默认 5 concurrent，OpenAI 因 tier 而异）。统一限制会浪费低并发 provider 的配额或触发高并发 provider 的限流。

### D7: 基于 pi-agent-core Layer 2

**决策**: 使用 `pi-agent-core` 的 `Agent` class 构建，不使用 `pi-coding-agent` 的 `createAgentSession`。

**理由**: Layer 2 提供最大控制——可直接管理 Agent 生命周期、工具注入、消息历史。Layer 3 带来了 session persistence、extensions、skills 等我们不必要的能力，增加了复杂度。Layer 1 太底层（需要自己实现 agentLoop）。

### D8: team.yaml 静态配置

**决策**: 团队配置在 team.yaml 中静态声明，运行时不可修改。

**理由**: 简化首版实现。动态增删 agent 增加了状态管理复杂度（消息路由、工具重分配、任务转移）。后续可通过扩展支持动态团队。

## Risks / Trade-offs

- **[Lead 流程偏离风险]** Lead 可能不严格遵循 workflow 描述 → 缓解：workflow 描述包含明确的门控规则和异常处理指引；后续可增加 workflow state tracker 做 validation
- **[文件冲突性能开销]** ToolScheduler 的文件冲突检测在大量并发操作时可能成为瓶颈 → 缓解：首版用简单文件路径匹配；后续可引入文件范围锁（directory-level locking）
- **[单进程扩展性]** 所有 agent 在同一 Node.js 进程 → 缓解：Node.js 事件循环天然适合 IO 密集的 LLM 调用；CPU 密集的 tool 执行由 ToolScheduler 串行化
- **[LLM 成本]** 多 agent 团队的 token 消耗是单 agent 的 N 倍 → 缓解：LLMScheduler 追踪 per-agent token 用量；可通过 team.yaml 限制 Lead 用便宜模型、Worker 用强模型
- **[JSONL replay 性能]** 长 session 的 replay 可能慢 → 缓解：定期 state snapshot（每隔 N 条消息保存完整状态，replay 从最近 snapshot 开始）
