## ADDED Requirements

### Requirement: Team progress panel
The system SHALL provide a TUI panel via Pi Extension API that displays real-time team status when a team session is active.

#### Scenario: Panel displays actor states
- **WHEN** team session is running
- **THEN** the TUI panel shows each actor's: role name, current state (ready/busy/error/shutdown), and current task summary (if busy)

#### Scenario: Panel displays message flow
- **WHEN** messages are exchanged between actors
- **THEN** the TUI panel shows a scrolling message log with: sender, recipient, message type, and brief payload summary

#### Scenario: Panel displays resource metrics
- **WHEN** team session is running
- **THEN** the TUI panel shows: active LLM calls per model, ToolScheduler queue depth, cumulative token usage per actor

### Requirement: Team lifecycle events
The Pi Extension SHALL emit events for team lifecycle: `team:start`, `team:end`, `actor:state_change`, `actor:message`, `resource:llm_call`, `resource:tool_call`.

#### Scenario: team:start event
- **WHEN** Orchestrator finishes bootstrap and Lead starts
- **THEN** a `team:start` event is emitted with team name, actor list, and config summary

#### Scenario: actor:state_change event
- **WHEN** any TeamActor transitions between states
- **THEN** an `actor:state_change` event is emitted with actorId, previous state, and new state

#### Scenario: team:end event
- **WHEN** team session ends (Lead calls shutdown_team or user aborts)
- **THEN** a `team:end` event is emitted with session summary including duration, token usage, and task completion stats
