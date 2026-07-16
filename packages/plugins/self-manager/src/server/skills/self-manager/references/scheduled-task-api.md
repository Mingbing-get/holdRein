# Scheduled Task API

Use these APIs when listing, creating, editing, enabling, disabling, or deleting
scheduled agent tasks. Call them through `requestSelfApi`.

## GET /api/v1/scheduled-tasks

Lists scheduled tasks, optionally filtered to one workspace.

Query parameters:

- `workspace`: Workspace path filter. Alias of `workspacePath`.
- `workspacePath`: Workspace path filter. Use this when available.

Returns:

- Scheduled task records.

## POST /api/v1/scheduled-tasks

Creates a scheduled agent task.

Body:

- `name`: Human-readable scheduled task name.
- `workspacePath`: Workspace where the agent should run.
- `provider`: Model provider id.
- `modelId`: Model id to use.
- `prompt`: Prompt to run on the schedule.
- `cronExpression`: Cron schedule expression.
- `timezone`: IANA timezone used to evaluate the cron schedule.
- `thinkingLevel`: Thinking level to use for the scheduled run.
- `allowConcurrentRuns`: Whether a new run may start while a previous run is active.
- `enabled`: Optional initial enabled state.

Returns:

- Created scheduled task record.

## GET /api/v1/scheduled-tasks/:id

Reads one scheduled task.

Path parameters:

- `id`: Scheduled task id.

Returns:

- Scheduled task record, or `notFound` when unknown.

## PATCH /api/v1/scheduled-tasks/:id

Updates one scheduled task.

Path parameters:

- `id`: Scheduled task id.

Body:

- Any subset of the create fields: `name`, `workspacePath`, `provider`,
  `modelId`, `prompt`, `cronExpression`, `timezone`, `thinkingLevel`,
  `allowConcurrentRuns`, and `enabled`.

Returns:

- Updated scheduled task record, or `notFound` when unknown.

## DELETE /api/v1/scheduled-tasks/:id

Deletes one scheduled task.

Path parameters:

- `id`: Scheduled task id.

Returns:

- `{ id: string }`.

## POST /api/v1/scheduled-tasks/:id/enable

Enables one scheduled task.

Path parameters:

- `id`: Scheduled task id.

Returns:

- Updated scheduled task record.

## POST /api/v1/scheduled-tasks/:id/disable

Disables one scheduled task.

Path parameters:

- `id`: Scheduled task id.

Returns:

- Updated scheduled task record.
