## ADDED Requirements

### Requirement: JSONL inbox replay for crash recovery
The system SHALL support recovering actor state by replaying JSONL inbox files after a crash.

#### Scenario: Recovery from JSONL replay
- **WHEN** user runs `/team-recover <team-name>` after a crash
- **THEN** Orchestrator reads each actor's JSONL inbox file, replays messages in chronological order, reconstructs actor states (including which tasks were in-flight), and resumes the team from the recovered state

#### Scenario: Partial message handling during replay
- **WHEN** a JSONL inbox file contains a partial/corrupted line (crash occurred mid-write)
- **THEN** the corrupted line SHALL be skipped and a warning logged; replay continues with subsequent valid lines

### Requirement: State snapshots
The system SHALL periodically save a state snapshot containing the full state of all actors, including message histories and current task assignments.

#### Scenario: Snapshot creation
- **WHEN** a configurable number of messages have been processed since the last snapshot (default: 100)
- **THEN** a state snapshot SHALL be written to `.pi/teams/<team-name>/snapshots/<timestamp>.json`

#### Scenario: Recovery using latest snapshot
- **WHEN** recovering from a crash and a state snapshot exists
- **THEN** Orchestrator SHALL load the latest snapshot and only replay JSONL messages that occurred after the snapshot, reducing recovery time

### Requirement: Ordered bootstrap for recovery
The system SHALL bootstrap actors in a deterministic order during recovery to ensure consistent state reconstruction.

#### Scenario: Deterministic actor creation order
- **WHEN** recovering a team from crash
- **THEN** actors SHALL be recreated in the same order as the original bootstrap (Lead first, then workers in team.yaml declaration order)

#### Scenario: No automatic restart on crash
- **WHEN** a fatal crash occurs
- **THEN** the system SHALL NOT automatically restart; user MUST explicitly invoke `/team-recover` to resume
