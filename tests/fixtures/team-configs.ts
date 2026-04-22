export const VALID_YAML = `
name: dev-team
lead:
  role: lead
  model: claude-sonnet-4-20250514
  system_prompt: |
    You are the lead developer. Coordinate tasks across team members.
  tools:
    - read_file
    - write_file
    - bash

workers:
  - role: backend
    model: claude-sonnet-4-20250514
    system_prompt: |
      You are a backend developer. Write clean, tested code.
    tools:
      - read_file
      - write_file
      - bash

  - role: reviewer
    model: claude-sonnet-4-20250514
    system_prompt: |
      You are a code reviewer. Review code for quality and correctness.
    tools:
      - read_file

settings:
  busyTimeoutMs: 300000
  snapshotInterval: 100
  modelConcurrency:
    claude-sonnet-4-20250514: 3
  maxRetries: 3
  baseRetryDelayMs: 1000
`;

export const MINIMAL_YAML = `
name: minimal-team
lead:
  role: lead
  model: claude-sonnet-4-20250514
  system_prompt: You coordinate tasks.
workers:
  - role: worker
    model: claude-sonnet-4-20250514
    system_prompt: You execute tasks.
`;

export const MISSING_NAME_YAML = `
lead:
  role: lead
  model: claude-sonnet-4-20250514
  system_prompt: Lead
workers:
  - role: worker
    model: claude-sonnet-4-20250514
    system_prompt: Worker
`;

export const MISSING_WORKERS_YAML = `
name: no-workers
lead:
  role: lead
  model: claude-sonnet-4-20250514
  system_prompt: Lead
`;

export const MISSING_LEAD_YAML = `
name: no-lead
workers:
  - role: worker
    model: claude-sonnet-4-20250514
    system_prompt: Worker
`;
