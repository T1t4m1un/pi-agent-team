## ADDED Requirements

### Requirement: Orchestrator bootstrap
The system SHALL provide an `Orchestrator` that parses a `team.yaml` file, creates TeamActor instances for each role, instantiates the EventBus and Schedulers, starts the Lead actor, and enters monitor mode.

#### Scenario: Team startup from team.yaml
- **WHEN** user runs `/team <team-name>` command
- **THEN** Orchestrator reads `<team-name>.yaml` from `.pi/teams/`, creates EventBus, ToolScheduler, LLMScheduler, creates TeamActor for each role, creates Lead actor, starts Lead with initial user message, and enters monitor mode

#### Scenario: Lead is independent from workers
- **WHEN** Orchestrator creates actors from team.yaml
- **THEN** the `lead` role is created as a separate TeamActor with its own system prompt and Lead-specific tools, distinct from any worker role

#### Scenario: Invalid team.yaml
- **WHEN** team.yaml has missing required fields or invalid structure
- **THEN** Orchestrator SHALL report a validation error with specific field names and SHALL NOT create any actors

### Requirement: Lead intelligent orchestration
The Lead actor SHALL receive workflow description from team.yaml as part of its system prompt context. Lead SHALL use its tools to drive the workflow based on this description and current team state.

#### Scenario: Lead assigns task to worker
- **WHEN** Lead determines a worker should perform a task (based on workflow context or direct user instruction)
- **THEN** Lead calls `assign_task` tool with target worker actorId, task description, and optional context

#### Scenario: Lead collects results
- **WHEN** Lead needs to gather results from one or more workers
- **THEN** Lead calls `collect_results` tool specifying target worker actorIds, and receives task results

#### Scenario: Lead handles workflow gate
- **WHEN** workflow description specifies a review/approval gate (e.g., RD LD must approve before RD starts coding)
- **THEN** Lead assigns review task to the reviewer, waits for result, and only assigns the next stage task if the result indicates approval

#### Scenario: Lead handles task rejection
- **WHEN** a worker returns a task_result with status indicating rejection or issues found (e.g., QA finds bugs, RD LD rejects design)
- **THEN** Lead determines next action based on workflow context—either reassign to the original worker with feedback, or escalate to user

### Requirement: Lead tools
The Lead actor SHALL have access to the following tools: `assign_task`, `broadcast`, `message_worker`, `collect_results`, `list_workers`, `shutdown_team`.

#### Scenario: assign_task tool invocation
- **WHEN** Lead calls `assign_task(actorId, task, context?)`
- **THEN** a `task_assign` message is sent to the target worker via EventBus, and the worker's state transitions to `busy`

#### Scenario: broadcast tool invocation
- **WHEN** Lead calls `broadcast(message)`
- **THEN** a broadcast message is sent to all workers via EventBus

#### Scenario: collect_results tool invocation
- **WHEN** Lead calls `collect_results(actorIds?)`
- **THEN** Lead receives pending task results from specified workers (or all workers if no actorIds specified)

#### Scenario: list_workers tool invocation
- **WHEN** Lead calls `list_workers()`
- **THEN** Lead receives current state of all workers including: actorId, role, state, current task summary

#### Scenario: shutdown_team tool invocation
- **WHEN** Lead calls `shutdown_team()`
- **THEN** `shutdown` messages are sent to all workers, all actors transition to `shutdown` state, and the team session ends

### Requirement: Orchestrator monitor mode
After starting the Lead, Orchestrator SHALL enter monitor mode where it tracks actor states, detects timeouts, and handles fatal errors.

#### Scenario: Actor timeout detection
- **WHEN** an actor remains in `busy` state beyond a configurable timeout
- **THEN** Orchestrator notifies Lead with timeout event including actorId and elapsed time

#### Scenario: Fatal error handling
- **WHEN** an unrecoverable error occurs (e.g., all providers fail, EventBus crashes)
- **THEN** Orchestrator sends `shutdown` to all actors, notifies user of the error, and persists final state to JSONL
