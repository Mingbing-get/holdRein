# Agent API

Use these APIs when viewing workspace skills or managing existing task metadata.
Call them through `requestSelfApi`.

## GET /api/v1/agents/skills

Lists skills available to a workspace.

Query parameters:

- `workspacePath`: Absolute workspace path whose `.agents/skills`,
  `.hold-rein/skills`, and configured skill directories should be inspected.

Returns:

- `{ skills: SkillSummary[] }`
- Each skill includes its id/name and path. Disabled status may be present when
  it is known.

## PATCH /api/v1/agents/tasks/:taskId

Renames an existing task.

Path parameters:

- `taskId`: The id of the task to rename.

Body:

- `title`: New non-empty task title after trimming whitespace.

Returns:

- Renamed task metadata.
- `notFound` when `taskId` does not identify a known task.

## DELETE /api/v1/agents/tasks/:taskId

Deletes an existing task when it is not running.

Path parameters:

- `taskId`: The id of the task to delete.

Returns:

- `{ taskId: string }` when deletion succeeds.
- `notFound` when the task is unknown.
- `conflict` when the task is currently running.
