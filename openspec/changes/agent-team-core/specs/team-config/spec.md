## ADDED Requirements

### Requirement: team.yaml schema validation
The system SHALL parse and validate `team.yaml` files against a defined schema. Required fields: `name`, `lead`, `workers`. The `lead` and each `worker` SHALL have: `role`, `model`, `system_prompt` (or `system_prompt_file`).

#### Scenario: Valid team.yaml parsed
- **WHEN** Orchestrator reads a team.yaml with all required fields
- **THEN** a typed `TeamConfig` object is returned with lead config, worker configs, and optional workflow description

#### Scenario: Missing required field
- **WHEN** team.yaml is missing a required field (e.g., no `lead` section)
- **THEN** a validation error SHALL be raised with the specific missing field name

#### Scenario: Invalid model identifier
- **WHEN** team.yaml references a model not available in the configured providers
- **THEN** a validation warning SHALL be logged and the system SHALL attempt to use the model (provider may reject at runtime)

### Requirement: Role-based tool assignment
team.yaml SHALL specify which tools each role has access to. Lead roles get Lead tools; worker roles get shared work tools + `message_lead`.

#### Scenario: Lead tool set
- **WHEN** a role is configured as `lead: true` in team.yaml
- **THEN** the actor SHALL receive Lead tools: `assign_task`, `broadcast`, `message_worker`, `collect_results`, `list_workers`, `shutdown_team`

#### Scenario: Worker tool set
- **WHEN** a role is configured as a worker in team.yaml
- **THEN** the actor SHALL receive shared work tools (filtered by role's `tools` list) plus `message_lead`

#### Scenario: Tool restriction by role
- **WHEN** a worker's `tools` list in team.yaml excludes certain shared tools (e.g., QA role has no `write_file`)
- **THEN** the actor SHALL NOT have access to the excluded tools

### Requirement: Workflow description in team.yaml
team.yaml MAY include a `workflow` section containing a natural language description of the team's process flow, including stages, gate rules, and role responsibilities. This description is injected into the Lead's system prompt as reference.

#### Scenario: Workflow description provided
- **WHEN** team.yaml includes a `workflow` section
- **THEN** the workflow description SHALL be included in the Lead's system prompt context as a reference section

#### Scenario: No workflow description
- **WHEN** team.yaml does not include a `workflow` section
- **THEN** the Lead operates purely on user instructions without predefined workflow context

### Requirement: Model configuration per role
Each role in team.yaml SHALL specify which LLM model to use. Different roles MAY use different models and providers.

#### Scenario: Role-specific model
- **WHEN** a worker role specifies `model: "anthropic/claude-sonnet-4-20250514"`
- **THEN** the actor's Agent SHALL use that model for all LLM calls

#### Scenario: Lead uses cheaper model
- **WHEN** Lead role specifies `model: "anthropic/claude-haiku-4-20250414"` while workers use stronger models
- **THEN** Lead's LLM calls use the cheaper model, workers use their configured models
