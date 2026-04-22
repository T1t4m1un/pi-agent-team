## 1. Project Setup

- [ ] 1.1 Initialize npm package `pi-agent-team` with TypeScript, configure tsconfig.json, add dependencies: `@mariozechner/pi-agent-core`, `@mariozechner/pi-coding-agent`, `@sinclair/typebox`, `yaml`
- [ ] 1.2 Create Pi Extension entry point: `src/index.ts` exporting `export default function(pi: ExtensionAPI)` that registers `/team` and `/team-recover` commands
- [ ] 1.3 Define TypeScript types for `TeamConfig`, `TeamMessage`, `ActorState`, `MessageType`, and all config interfaces

## 2. Core Actor Model

- [ ] 2.1 Implement `ActorStateMachine` with states (created, ready, busy, error, shutdown) and valid transition enforcement
- [ ] 2.2 Implement `TeamActor` class wrapping `pi-agent-core` Agent: constructor accepts actorId, role, model, system prompt, tools, and creates underlying Agent instance
- [ ] 2.3 Implement TeamActor lifecycle: `init()` transitions created→ready and registers EventBus listener, `assignTask()` transitions ready→busy and invokes Agent, `completeTask()` transitions busy→ready
- [ ] 2.4 Implement error handling in TeamActor: on Agent error transition to error state, send error message to Lead, await Lead decision (retry or abort)
- [ ] 2.5 Implement TeamActor shutdown: receive shutdown message from any state, abort in-progress Agent execution, unregister from EventBus, transition to shutdown

## 3. Messaging Layer

- [ ] 3.1 Implement `EventBus` class: `subscribe(actorId, handler)`, `publish(message)`, `broadcast(message)`, with per-actor message filtering (direct + broadcast)
- [ ] 3.2 Implement `TeamMessage` protocol: enforce required fields (id, from, to, type, payload, timestamp), generate unique IDs, validate message types
- [ ] 3.3 Implement JSONL inbox persistence: append incoming/outgoing messages to `.pi/teams/<team-name>/inboxes/<actorId>.jsonl`, one JSON object per line
- [ ] 3.4 Implement message ordering guarantee: messages from a single actor are delivered to each subscriber in publish order

## 4. Team Configuration

- [ ] 4.1 Define team.yaml JSON Schema and implement parser: validate required fields (name, lead, workers), parse role configs (role, model, system_prompt, tools)
- [ ] 4.2 Implement role-based tool factory: for Lead roles, create Lead tools (assign_task, broadcast, message_worker, collect_results, list_workers, shutdown_team); for worker roles, create filtered shared work tools + message_lead
- [ ] 4.3 Implement workflow description extraction: parse optional `workflow` section from team.yaml and format it for Lead system prompt injection
- [ ] 4.4 Implement per-role model assignment: configure each actor's Agent with the specified model from team.yaml

## 5. Tool Scheduler

- [ ] 5.1 Implement `ToolScheduler` class: intercept shared work tool invocations, route through per-tool-type FIFO queues
- [ ] 5.2 Implement file conflict detection: track active file operations by normalized path, serialize same-file write operations, allow parallel reads, block reads during active writes
- [ ] 5.3 Implement cross-tool-type parallelism: different tool types execute concurrently while same-type operations are serialized within their queue
- [ ] 5.4 Implement tool result delivery: return scheduler-managed tool execution results back to the invoking actor's Agent tool result handler

## 6. LLM Scheduler

- [ ] 6.1 Implement `LLMScheduler` class: per-model concurrency counters, pending queue per model, dequeue and execute on slot release
- [ ] 6.2 Implement 429 retry: detect 429 responses, exponential backoff with jitter, respect Retry-After header, configurable max retries (default 3)
- [ ] 6.3 Implement token tracking: record per-actor per-model token usage (input, output, cache_read, cache_write) from LLM responses
- [ ] 6.4 Implement session cost summary: output total tokens and estimated cost per actor per model when team session ends

## 7. Orchestration

- [ ] 7.1 Implement `Orchestrator` bootstrap: parse team.yaml → create EventBus, ToolScheduler, LLMScheduler → create Lead actor → create worker actors → start Lead → enter monitor mode
- [ ] 7.2 Implement `/team` command handler: accept team name + optional task description, invoke Orchestrator bootstrap, pass initial message to Lead
- [ ] 7.3 Implement Lead tools as LLM-callable tools (TypeBox schemas): assign_task(actorId, task, context?), broadcast(message), message_worker(actorId, message), collect_results(actorIds?), list_workers(), shutdown_team()
- [ ] 7.4 Implement worker `message_lead` tool: single tool for all worker→Lead communication (task_result, error, question)
- [ ] 7.5 Implement Orchestrator monitor mode: track actor states, detect busy-state timeout (configurable), notify Lead on timeout, handle fatal errors (shutdown all, notify user, persist state)

## 8. Crash Recovery

- [ ] 8.1 Implement JSONL inbox replay: read actor JSONL files chronologically, reconstruct message history and actor states, identify in-flight tasks
- [ ] 8.2 Implement state snapshots: periodically serialize all actor states + message histories to `.pi/teams/<team-name>/snapshots/<timestamp>.json`, configurable interval (default 100 messages)
- [ ] 8.3 Implement `/team-recover` command: load latest snapshot, replay only post-snapshot JSONL messages, recreate actors in deterministic order (Lead first, workers in team.yaml order), resume team
- [ ] 8.4 Implement partial JSONL handling: skip corrupted/truncated lines during replay with warning log

## 9. TUI & Observability

- [ ] 9.1 Implement Pi Extension event hooks: emit `team:start`, `team:end`, `actor:state_change`, `actor:message`, `resource:llm_call`, `resource:tool_call` events
- [ ] 9.2 Implement TUI progress panel via Pi Extension API: display actor states, current task summaries, message flow log, resource metrics (active LLM calls, ToolScheduler queue depth, token usage)

## 10. Testing Infrastructure

- [ ] 10.1 Configure Vitest with TypeScript support, three test directories (`tests/unit/`, `tests/integration/`, `tests/smoke/`), npm scripts (`test`, `test:smoke`, `test:coverage`)
- [ ] 10.2 Create mock LLM provider: returns predetermined responses, tracks call count and arguments, simulates errors and 429s
- [ ] 10.3 Create test fixtures: minimal team.yaml configs, mock system prompts, temp directory helpers for JSONL/file operations
- [ ] 10.4 Implement environment gating for smoke tests: skip unless `PI_SMOKE_TEST=true`, with clear skip message

## 11. Unit Tests

- [ ] 11.1 Unit test ActorStateMachine: all valid transitions, invalid transitions rejected with error, state query accuracy
- [ ] 11.2 Unit test EventBus: subscribe/publish, broadcast, message ordering, subscriber filtering, unsubscribe
- [ ] 11.3 Unit test TeamMessage protocol: required field validation, unknown type rejection, ID uniqueness, replyTo correlation
- [ ] 11.4 Unit test ToolScheduler conflict detection: same-file write serialization, concurrent read parallelization, read-during-write blocking, path normalization
- [ ] 11.5 Unit test LLMScheduler: concurrency limit enforcement, pending queue FIFO dequeue, 429 retry backoff timing, Retry-After header, max retry exhaustion
- [ ] 11.6 Unit test team.yaml parser: valid config parsing, missing field errors, role tool mapping, model assignment, workflow extraction

## 12. Integration Tests

- [ ] 12.1 Integration test: full team bootstrap — Orchestrator creates actors from team.yaml, Lead starts, Lead assigns task to worker via mock LLM, worker completes, Lead receives result
- [ ] 12.2 Integration test: multi-worker parallel execution — Lead assigns tasks to two workers simultaneously, verify concurrent execution and ToolScheduler managing shared file access
- [ ] 12.3 Integration test: error propagation — worker mock LLM returns error, worker transitions to error, Lead receives error message and decides action
- [ ] 12.4 Integration test: JSONL persistence and replay — run session, verify JSONL content, perform recovery, verify state reconstruction
- [ ] 12.5 Integration test: workflow gate — mock Lead follows workflow with review gate, verifies approval before proceeding, handles rejection
- [ ] 12.6 Integration test: crash recovery — simulate crash mid-task with partial JSONL + snapshot, verify recovery loads snapshot, replays post-snapshot messages, resumes correctly

## 13. Smoke Tests

- [ ] 13.1 Smoke test: minimal two-agent team with real LLM — Lead + 1 Worker, simple task assignment and completion, clean shutdown
- [ ] 13.2 Smoke test: product-dev-test pipeline — full 5-agent team (Lead + PM + RD LD + RD + QA), user provides feature request, verify each stage produces deliverables
- [ ] 13.3 Smoke test: timeout and cleanup — verify 5-minute max duration, clean shutdown on timeout, no orphaned processes

## 14. Example Team Config

- [ ] 14.1 Create example `product-dev-test.yaml`: Lead + PM + RD LD + RD + QA roles, workflow description for the PM→RD LD review→RD code→QA test pipeline, tool permissions per role
- [ ] 14.2 Create example system prompt files for each role in the product-dev-test team
- [ ] 14.3 Add README with usage instructions: installation, team.yaml authoring, running teams, recovery
