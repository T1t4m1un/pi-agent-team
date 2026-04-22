## ADDED Requirements

### Requirement: TeamActor lifecycle management
The system SHALL provide a `TeamActor` class that wraps a `pi-agent-core` `Agent` instance with team-specific lifecycle management. Each TeamActor SHALL have a unique `actorId`, a `role` identifier, and an `ActorStateMachine` governing its state transitions.

#### Scenario: Actor creation from team config
- **WHEN** Orchestrator parses team.yaml and creates an actor for a role
- **THEN** a TeamActor is instantiated with: actorId (derived from role name), Agent instance (with role-specific model/tools/system prompt), and state set to `created`

#### Scenario: Actor initialization
- **WHEN** TeamActor is created and EventBus is ready
- **THEN** TeamActor transitions to `ready` state and registers itself as a message listener on the EventBus

#### Scenario: Actor receives task assignment
- **WHEN** TeamActor in `ready` state receives a `task_assign` message addressed to its actorId
- **THEN** TeamActor transitions to `busy`, invokes the underlying Agent with the task payload, and sends a `task_result` message upon completion

#### Scenario: Actor task success
- **WHEN** Agent completes task execution without error
- **THEN** TeamActor sends `task_result` with status `success` and result payload, then transitions back to `ready`

#### Scenario: Actor task failure
- **WHEN** Agent execution throws an error or exceeds timeout
- **THEN** TeamActor sends `task_result` with status `error` and error details, then transitions to `error` state and awaits Lead decision

### Requirement: ActorStateMachine state transitions
The system SHALL enforce valid state transitions: `created` → `ready` → `busy` → (`ready` | `error`), `error` → (`ready` | `shutdown`), any state → `shutdown`.

#### Scenario: Invalid state transition rejected
- **WHEN** a state transition is attempted that is not in the valid transition set (e.g., `created` → `busy`)
- **THEN** the transition SHALL be rejected and an error SHALL be logged

#### Scenario: Shutdown from any state
- **WHEN** TeamActor receives a `shutdown` message in any state
- **THEN** TeamActor transitions to `shutdown`, aborts any in-progress Agent execution, and unregisters from EventBus

### Requirement: Actor message routing
Each TeamActor SHALL only process messages addressed to its `actorId` or broadcast messages. Messages addressed to other actors SHALL be silently ignored.

#### Scenario: Direct message received
- **WHEN** TeamActor receives a message with `to` field matching its actorId
- **THEN** the message is queued for processing by the actor's message handler

#### Scenario: Broadcast message received
- **WHEN** TeamActor receives a message with `to` field set to `broadcast`
- **THEN** the message is processed by the actor's broadcast handler

#### Scenario: Message for another actor ignored
- **WHEN** TeamActor receives a message with `to` field not matching its actorId and not `broadcast`
- **THEN** the message is ignored without error
