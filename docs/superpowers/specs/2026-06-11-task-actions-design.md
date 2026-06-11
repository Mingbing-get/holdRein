# Task Actions Design

## Goal

Allow users to rename and delete tasks from the web sidebar while preserving
task and session data consistency.

## User Experience

- Hovering a task row reveals a three-dot action button on the right.
- Hovering or clicking the button opens a menu with:
  - edit icon and `重命名`
  - delete icon and dangerous `删除`
- Renaming opens a modal containing the current visible task title. The trimmed
  title must not be empty. Confirming sends the update request and updates the
  sidebar title.
- Deleting opens a confirmation modal. Confirming deletes the task and its
  session file.
- Running tasks cannot be deleted. The API returns a conflict and the web app
  shows the returned message.
- Deleting the active task clears the active task selection. Deleting another
  task keeps the current selection.

## Architecture

Task mutation endpoints live in the agents router because they operate on
individual agent tasks. The agents service validates task state, updates the
repository, and deletes the task session file. The workspace repository exposes
the minimal task deletion operation.

The web workspace navigation API exposes rename and delete helpers.
`WorkspaceSection` owns the task action menu and modals, while the app workspace
context owns local task title and removal state transitions.

## API

- `PATCH /api/v1/agents/tasks/:taskId` with `{ "title": "New title" }`
- `DELETE /api/v1/agents/tasks/:taskId`

Rename returns `{ id, title }`. Delete returns `{ taskId }`. Unknown tasks return
404, empty titles return 400, and running task deletion returns 409.

## Data Integrity

For deletion, the service deletes the session file before deleting the task
database row. Missing session files are allowed. Other file deletion errors
leave the database task intact.

## Testing

- Repository tests cover deleting one task.
- Agents service tests cover rename, file deletion, missing files, file errors,
  unknown tasks, and running task protection.
- Router tests cover request validation and status mappings.
- Web API tests cover encoded URLs, methods, bodies, and API errors.
- Context tests cover active and inactive task removal.
- Workspace section tests cover the hover menu, rename flow, delete
  confirmation, conflict feedback, and local state updates.
