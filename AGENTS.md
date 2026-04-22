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

## 测试注意事项

- 测试框架：vitest
- 测试中用真实临时目录（`mkdtemp`），不用 mock fs
- mock 工厂在 `tests/helpers/mocks.ts`
- fixture 在 `tests/fixtures/`（`messages.ts`、`team-configs.ts`）
- 集成/单元测试中涉及 `.pi/teams/` 的，afterEach 要清理避免污染
- smoke 测试默认跳过，需设 `PI_SMOKE_TEST=true`
- vitest 默认排除 `tests/smoke/`，超时 30s

## TypeScript 配置

- `module: Node16`，`moduleResolution: Node16`
- 路径别名 `@/* → ./src/*` 仅在 tsconfig 中声明，vitest 另外配了 `@test → ./tests`
- 所有导入路径必须带 `.js` 后缀（Node16 ESM 要求）

## 恢复流程

`/team <team-name>` 命令会自动检测是否存在 active 的 session manifest：
- 有 → `orchestrator.recover()`：加载 manifest → 解析 config → 重放 JSONL inbox → 恢复 pending tasks → resume
- 无 → `orchestrator.bootstrap()`：全新启动

没有独立的 `/team-recover` 命令。
