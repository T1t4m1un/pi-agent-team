## ADDED Requirements

### Requirement: Tool registration and routing
The system SHALL provide a `ToolScheduler` that intercepts all shared work tool invocations from actors and routes them through per-tool-type queues. Shared work tools include: `read_file`, `write_file`, `edit_file`, `bash`, `grep`, `glob`, `list_directory`.

#### Scenario: Tool invocation interception
- **WHEN** an actor's Agent invokes a shared work tool
- **THEN** the invocation is captured by ToolScheduler before execution and placed in the appropriate tool-type queue

#### Scenario: Per-tool-type FIFO queue
- **WHEN** multiple tool invocations of the same type are queued
- **THEN** they SHALL be executed in FIFO order, one at a time per tool type

#### Scenario: Different tool types execute in parallel
- **WHEN** invocations of different tool types are queued (e.g., `read_file` and `bash`)
- **THEN** they MAY execute concurrently

### Requirement: File conflict detection
The ToolScheduler SHALL detect when multiple tool invocations target the same file path and serialize them.

#### Scenario: Same file write operations serialized
- **WHEN** two actors invoke `write_file` or `edit_file` targeting the same file path concurrently
- **THEN** the second invocation SHALL wait until the first completes before executing

#### Scenario: Read operations not blocked by reads
- **WHEN** multiple actors invoke `read_file` on the same file path concurrently
- **THEN** all read operations MAY execute in parallel

#### Scenario: Read blocked by active write
- **WHEN** an actor invokes `read_file` on a file that has an active `write_file` or `edit_file` in progress
- **THEN** the read SHALL wait until the write completes

#### Scenario: File path normalization
- **WHEN** file conflict detection compares paths
- **THEN** paths SHALL be normalized (resolve `.`, `..`, trailing slashes) before comparison

### Requirement: Tool execution result delivery
The ToolScheduler SHALL deliver tool execution results back to the invoking actor's Agent as if the tool executed directly.

#### Scenario: Successful tool execution
- **WHEN** a queued tool invocation completes successfully
- **THEN** the result is returned to the invoking Agent's tool result handler

#### Scenario: Tool execution error
- **WHEN** a queued tool invocation fails
- **THEN** the error is returned to the invoking Agent's tool result handler, and the actor decides whether to retry or report to Lead
