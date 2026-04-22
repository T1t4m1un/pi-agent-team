## ADDED Requirements

### Requirement: Per-model concurrency control
The system SHALL provide an `LLMScheduler` that manages concurrent LLM API calls per model identifier. Each model SHALL have an independent concurrency limit.

#### Scenario: Concurrency limit enforced
- **WHEN** an actor's Agent initiates an LLM call for a model that has reached its concurrency limit
- **THEN** the request SHALL be placed in a pending queue and executed when a slot becomes available

#### Scenario: Request dequeued on slot release
- **WHEN** an in-flight LLM call completes and frees a concurrency slot
- **THEN** the next pending request for that model SHALL be dequeued and executed immediately

#### Scenario: Model concurrency limit configured
- **WHEN** team.yaml specifies `concurrency` for a model
- **THEN** LLMScheduler SHALL use that value as the maximum concurrent calls for that model

#### Scenario: Default concurrency limit
- **WHEN** team.yaml does not specify `concurrency` for a model
- **THEN** LLMScheduler SHALL use a default limit of 5 concurrent calls

### Requirement: 429 retry handling
The LLMScheduler SHALL automatically retry requests that receive HTTP 429 (Too Many Requests) responses.

#### Scenario: Retry on 429
- **WHEN** an LLM call receives a 429 response
- **THEN** LLMScheduler SHALL retry the request after a delay, using exponential backoff with jitter

#### Scenario: Max retries exceeded
- **WHEN** a request has been retried the maximum number of times (configurable, default 3) and still receives 429
- **THEN** LLMScheduler SHALL return an error to the invoking actor

#### Scenario: Retry respects Retry-After header
- **WHEN** a 429 response includes a `Retry-After` header
- **THEN** LLMScheduler SHALL use that value as the retry delay instead of calculated backoff

### Requirement: Token and cost tracking
The LLMScheduler SHALL track token usage (input, output, cache_read, cache_write) per actor per model per session.

#### Scenario: Token usage recorded
- **WHEN** an LLM call completes with a usage response
- **THEN** LLMScheduler SHALL record the token counts against the calling actor's ID and model

#### Scenario: Usage query
- **WHEN** Lead calls `list_workers()` or user queries team metrics
- **THEN** cumulative token usage per actor SHALL be included in the response

#### Scenario: Session-level cost aggregation
- **WHEN** team session ends
- **THEN** LLMScheduler SHALL output a summary of total tokens and estimated cost per actor per model
