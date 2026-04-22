# AGENTS.md

## 语言

- 对话、文档（README、AGENTS.md 等）、代码注释用中文
- 代码标识符、commit message、PR 描述用英文

## 开发命令

```bash
pnpm run check          # 完整门禁：tsc --noEmit → lint → format:check → test
```

单独运行：

```bash
pnpm run build          # tsc 编译
pnpm run lint           # eslint src tests
pnpm run lint:fix       # eslint --fix
pnpm run format         # prettier --write
pnpm run format:check   # prettier --check
pnpm test               # vitest run tests/unit tests/integration
pnpm run test:unit      # 仅单元测试
pnpm run test:integration  # 仅集成测试
pnpm run test:smoke     # 需要 PI_SMOKE_TEST=true
```

跑单个测试文件：

```bash
npx vitest run tests/unit/actor/state-machine.test.ts
```

## 代码风格

- 两空格缩进（`.prettierrc` 已配置）
- 双引号、分号、trailing comma
- 写完代码必须跑 `pnpm run format && pnpm run lint:fix`
- `src/` 下禁止用 `..` 相对路径导入，必须用 `@/` 别名
- `tests/` 下用 `@test/` 别名指向 `tests/`
- 导入排序：builtin → external → internal → parent → sibling → index，无空行，字母序

## 禁止 barrel re-export index

不要创建 `index.ts` 做 re-export barrel 文件。直接从具体模块导入：

```ts
// 好
import { MINIMAL_YAML } from "@test/fixtures/team-configs.js";
import { createMockEventBus } from "@test/helpers/mocks.js";

// 禁止
import { MINIMAL_YAML } from "@test/fixtures/index.js";
```

`src/index.ts` 作为扩展入口的导出例外，允许集中导出公开 API。

## 架构要点

- `src/index.ts` — Pi 扩展入口，注册 `/team` 命令（含自动恢复检测）
- `src/orchestration/orchestrator.ts` — 核心编排器，`bootstrap()` 启动新会话，`recover()` 恢复中断会话
- `src/recovery/` — `snapshot.ts`（快照管理 + JSONL 回放）、`session-manifest.ts`（会话生命周期 tracking）
- `src/actor/team-actor.ts` — 封装 pi-agent-core 的 `Agent`，状态机驱动
- `src/messaging/` — EventBus 发布订阅 + JsonlInbox 持久化
- `src/scheduler/` — LLM 并发控制 + 工具调度（文件冲突检测）
- `src/types.ts` — 所有类型定义，`DEFAULT_SETTINGS` 在此

## 测试规范

### 层次化测试

项目采用四层测试金字塔，每层有明确的职责边界和运行策略：

| 层次 | 目录 | 职责 | 运行命令 | CI |
|------|------|------|----------|----|
| 单元测试 | `tests/unit/` | 单个模块/函数的输入输出正确性，mock 外部依赖 | `pnpm run test:unit` | 每次 |
| 集成测试 | `tests/integration/` | 模块间协作正确性（config→tools、eventbus→inbox、recovery flow），可用真实 fs | `pnpm run test:integration` | 每次 |
| 冒烟测试 | `tests/smoke/` | 端到端核心路径（bootstrap、extension 注册），需真实 Pi 环境 | `PI_SMOKE_TEST=true pnpm run test:smoke` | 手动 / 发版前 |
| 线上回归 | — | 部署后验证生产环境健康度（canary check） | `npx gstack canary` 或 `/canary` | 部署后 |

```bash
pnpm test                # 单元 + 集成（CI 默认）
pnpm run test:unit       # 仅单元
pnpm run test:integration  # 仅集成
pnpm run test:coverage   # 带 coverage 报告
```

### 单元测试

- **目标**：验证单个函数/类的逻辑正确性
- **规则**：
  - mock 所有外部依赖（Agent、LLM 调用、fs 网络）
  - 不依赖执行顺序，每个 test case 独立
  - 测试文件与源文件目录结构镜像（`src/config/parser.ts` → `tests/unit/config/parser.test.ts`）
  - mock 工厂在 `tests/helpers/mocks.ts`，fixture 在 `tests/fixtures/`
- **覆盖范围**：
  - `config/` — parser 解析、generator 生成、workflow 提取
  - `actor/` — 状态机转换、非法转换报错
  - `messaging/` — EventBus 路由、Message 校验、JsonlInbox 读写
  - `scheduler/` — LLM 并发控制、ToolScheduler 队列与冲突检测
  - `recovery/` — session-manifest CRUD、snapshot 保存加载
  - `orchestration/` — orchestrator 方法逻辑（用 mock actors）
  - `tools/` — tool 元数据、tool 执行逻辑

### 集成测试

- **目标**：验证模块间协作正确性
- **规则**：
  - 可使用真实临时目录（`mkdtemp`），不用 mock fs
  - afterEach 清理 `.pi/teams/` 避免跨测试污染
  - 测试跨模块的数据流（config → tools → messages）
- **覆盖范围**：
  - config 解析 → lead tools 创建（tool 名称、worker 列表）
  - EventBus + JsonlInbox 消息持久化与回放
  - recovery flow：bootstrap → snapshot → recover → 验证状态恢复
  - team-init tool 端到端文件生成

### 冒烟测试

- **目标**：验证核心端到端路径在真实环境中可用
- **规则**：
  - 默认跳过（`describe.skipIf(!SMOKE_ENABLED)`），需 `PI_SMOKE_TEST=true`
  - vitest 配置默认排除 `tests/smoke/`，超时 30s
  - 需要真实 Pi Agent 运行环境
- **覆盖范围**：
  - `/team` 命令完整 bootstrap 流程
  - extension 注册验证（命令、tool 均可用）

### 线上回归

- **目标**：部署后验证生产环境没有回归
- **方式**：通过 `/canary` 或 `npx gstack canary` 执行部署后监控
- **关注点**：
  - console 错误、页面加载失败、性能回归
  - 与部署前 baseline 对比
  - 周期性截图 + 自动告警

### 提测方案

每个功能/变更的 PR 必须同步给出以下内容：

1. **实现方案** — 改了什么、为什么这样改（PR 描述或关联 design doc）
2. **测试方案** — 新增/修改了哪些测试、覆盖了哪些场景、边界条件是什么
3. **验收方案** — 如何验证功能正确（手动步骤或自动化测试命令）

```markdown
## 实现方案
<!-- 架构变更说明 -->

## 测试方案
<!-- 新增/修改的测试文件和用例说明 -->

## 验收方案
<!-- 运行命令或手动验证步骤 -->
```

跑单个测试文件：

```bash
npx vitest run tests/unit/actor/state-machine.test.ts
```

## TypeScript 配置

- `module: Node16`，`moduleResolution: Node16`
- 路径别名 `@/* → ./src/*` 仅在 tsconfig 中声明，vitest 另外配了 `@test → ./tests`
- 所有导入路径必须带 `.js` 后缀（Node16 ESM 要求）

## 恢复流程

`/team <team-name>` 命令会自动检测是否存在 active 的 session manifest：
- 有 → `orchestrator.recover()`：加载 manifest → 解析 config → 重放 JSONL inbox → 恢复 pending tasks → resume
- 无 → `orchestrator.bootstrap()`：全新启动

没有独立的 `/team-recover` 命令。
