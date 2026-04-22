## ADDED Requirements

### Requirement: Unit test coverage for core modules
The system SHALL have unit tests for all pure logic modules: ActorStateMachine, EventBus, TeamMessage validation, ToolScheduler conflict detection, LLMScheduler queue/retry logic, team.yaml parser/validation.

#### Scenario: ActorStateMachine transitions tested
- **WHEN** unit tests run against ActorStateMachine
- **THEN** all valid transitions (created→ready, ready→busy, busy→ready, busy→error, error→ready, error→shutdown, any→shutdown) are verified, and invalid transitions are verified to be rejected

#### Scenario: EventBus pub/sub tested
- **WHEN** unit tests run against EventBus
- **THEN** direct message delivery, broadcast delivery, message ordering, and subscriber filtering are verified with no external dependencies

#### Scenario: ToolScheduler conflict detection tested
- **WHEN** unit tests run against ToolScheduler file conflict logic
- **THEN** same-file writes are verified to serialize, concurrent reads are verified to parallelize, read-during-write is verified to block, and path normalization is verified

#### Scenario: LLMScheduler queue logic tested
- **WHEN** unit tests run against LLMScheduler with mock timers
- **THEN** concurrency limit enforcement, pending queue dequeue order, 429 retry backoff timing, and Retry-After header handling are verified without real API calls

#### Scenario: team.yaml parser validated
- **WHEN** unit tests run against config parser
- **THEN** valid configs parse correctly, missing required fields produce specific errors, unknown fields produce warnings, and role tool mapping is verified

### Requirement: Integration tests with mock LLM
The system SHALL have integration tests that exercise multi-component interactions using a mock LLM provider that returns predetermined responses.

#### Scenario: Full team bootstrap and task assignment
- **WHEN** an integration test starts a team from a minimal team.yaml with mock LLM
- **THEN** Orchestrator creates all actors, Lead starts, Lead assigns task to worker, worker processes task via mock LLM, worker sends result to Lead, Lead receives result

#### Scenario: Multi-worker parallel execution
- **WHEN** Lead assigns tasks to two workers simultaneously via mock LLM
- **THEN** both workers execute concurrently, results are delivered back to Lead, and ToolScheduler correctly manages concurrent tool access

#### Scenario: Error propagation to Lead
- **WHEN** a worker's mock LLM returns an error response
- **THEN** worker transitions to error state, error message is sent to Lead, Lead receives the error and can decide next action

#### Scenario: JSONL persistence and replay
- **WHEN** integration test runs a team session, writes JSONL, then performs recovery
- **THEN** all messages are present in JSONL files, replay reconstructs correct actor states, and the team resumes from the recovered state

#### Scenario: Workflow gate enforcement by Lead
- **WHEN** mock Lead receives workflow description with a review gate (e.g., RD LD must approve before RD starts)
- **THEN** Lead assigns review to RD LD first, waits for approval result, only assigns coding task to RD if approved, and handles rejection by reassigning to PM with feedback

#### Scenario: File conflict between workers
- **WHEN** two workers attempt to write the same file concurrently via mock tool execution
- **THEN** ToolScheduler serializes the writes, the second write completes after the first, and no data corruption occurs

#### Scenario: Crash recovery integration
- **WHEN** integration test simulates a crash mid-task (writes partial JSONL + snapshot)
- **THEN** recovery loads snapshot, replays post-snapshot messages, recreates actors in order, and the team resumes with correct state

### Requirement: Smoke tests with real LLM
The system SHALL have smoke tests that run against real LLM providers to validate end-to-end functionality. These tests are gated behind environment variables and NOT run in CI by default.

#### Scenario: Minimal two-agent team with real LLM
- **WHEN** smoke test starts a team with Lead + 1 Worker using a real LLM provider
- **THEN** user sends a simple task, Lead assigns to worker, worker completes task using real LLM, result is returned to Lead, team shuts down cleanly

#### Scenario: Product-dev-test pipeline smoke test
- **WHEN** smoke test starts the product-dev-test team (Lead + PM + RD LD + RD + QA) with real LLMs
- **THEN** user provides a feature request, PM produces a proposal, RD LD reviews and approves, RD writes code, QA writes and runs tests, Lead coordinates the full pipeline, and all deliverables are produced

#### Scenario: Smoke test timeout and cleanup
- **WHEN** a smoke test exceeds a maximum duration (configurable, default 5 minutes)
- **THEN** the test SHALL fail with a timeout error, all actors are shut down, and no orphaned processes remain

#### Scenario: Smoke test environment gating
- **WHEN** smoke tests are invoked without the required environment variable (e.g., `PI_SMOKE_TEST=true`)
- **THEN** smoke tests SHALL be skipped with a clear message indicating how to enable them

### Requirement: Test infrastructure and tooling
The system SHALL use Vitest as the test framework. Tests SHALL be organized in three directories: `tests/unit/`, `tests/integration/`, `tests/smoke/`.

#### Scenario: Test script commands
- **WHEN** developer runs `npm test`
- **THEN** unit tests and integration tests run (smoke tests excluded)

#### Scenario: Smoke test command
- **WHEN** developer runs `npm run test:smoke`
- **THEN** only smoke tests run, requiring `PI_SMOKE_TEST=true` environment variable

#### Scenario: Coverage reporting
- **WHEN** developer runs `npm run test:coverage`
- **THEN** unit and integration test coverage is reported, with a minimum threshold of 80% line coverage for core modules (ActorStateMachine, EventBus, ToolScheduler, LLMScheduler, config parser)
