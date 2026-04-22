## ADDED Requirements

### Requirement: EventBus in-memory pub/sub
The system SHALL provide an EventBus implementing publish-subscribe pattern for real-time inter-actor communication within the process.

#### Scenario: Actor subscribes to messages
- **WHEN** a TeamActor registers a message handler on the EventBus with its actorId
- **THEN** subsequent messages with `to` matching that actorId or `to` set to `broadcast` SHALL be delivered to the handler

#### Scenario: Message delivery
- **WHEN** a TeamActor publishes a TeamMessage to the EventBus
- **THEN** the EventBus SHALL deliver the message to the subscriber matching the `to` field (direct) or all subscribers (broadcast)

#### Scenario: Message ordering guarantee
- **WHEN** multiple messages are published in sequence from a single actor
- **THEN** the EventBus SHALL deliver them to each subscriber in the same order they were published

### Requirement: TeamMessage protocol
All inter-actor messages SHALL conform to the `TeamMessage` interface with fields: `id` (unique), `from` (sender actorId), `to` (recipient actorId or "broadcast"), `type` (message type enum), `payload` (typed data), `timestamp` (ISO 8601), and optional `replyTo` (correlation ID).

#### Scenario: Message type validation
- **WHEN** a TeamMessage is published with an unrecognized `type` field
- **THEN** the EventBus SHALL reject the message and log a warning

#### Scenario: Reply correlation
- **WHEN** a worker sends `task_result` with `replyTo` set to the original `task_assign` message ID
- **THEN** the Lead can correlate the result with the original assignment

### Requirement: JSONL inbox persistence
Each actor SHALL have a JSONL inbox file at `.pi/teams/<team-name>/inboxes/<actorId>.jsonl` where every incoming and outgoing message is appended as one JSON line.

#### Scenario: Message persistence on send
- **WHEN** a TeamActor sends a message via EventBus
- **THEN** the message is appended to the sender's JSONL inbox as an outgoing entry

#### Scenario: Message persistence on receive
- **WHEN** a TeamActor receives a message from EventBus
- **THEN** the message is appended to the recipient's JSONL inbox as an incoming entry

#### Scenario: O(1) append performance
- **WHEN** a message is appended to a JSONL inbox file
- **THEN** the operation SHALL complete in constant time regardless of existing file size

### Requirement: Worker communication via message_lead
Each worker actor SHALL have access to a single `message_lead` tool for all worker-to-Lead communication. Workers SHALL NOT have tools to message other workers directly.

#### Scenario: Worker sends result to Lead
- **WHEN** worker calls `message_lead(type, payload, replyTo?)`
- **THEN** a TeamMessage is sent from the worker to the Lead via EventBus and persisted to JSONL

#### Scenario: Worker reports error to Lead
- **WHEN** worker encounters an error during task execution
- **THEN** worker calls `message_lead` with type `error` and error details in payload
