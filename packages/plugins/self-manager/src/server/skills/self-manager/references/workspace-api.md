# Workspace API

Use these APIs when viewing workspace history, changing workspace settings, or
deleting workspaces. Call them through `requestSelfApi`.

## GET /api/v1/workspaces/recent-tasks

Lists recently used workspaces with task summaries.

Returns:

- Recent workspace task summaries.

## DELETE /api/v1/workspaces/:workspaceId

Deletes a workspace when it exists and has no running tasks.

Path parameters:

- `workspaceId`: The workspace id to delete.

Returns:

- `{ workspaceId: string }`.
- `conflict` when the workspace has running tasks.

## GET /api/v1/workspaces/:workspaceId/setting

Reads plugin and skill settings for a workspace.

Path parameters:

- `workspaceId`: The workspace id whose settings should be read.

Returns:

- `{ activePlugins: string[] | null; activeSkills: string[] | null }`.

## PATCH /api/v1/workspaces/:workspaceId/setting

Updates plugin and skill allow-lists for a workspace.

Path parameters:

- `workspaceId`: The workspace id whose settings should be updated.

Body:

- `activePlugins`: Array of active plugin ids, `null` to clear the allow-list,
  or omit to leave unchanged.
- `activeSkills`: Array of active skill ids, `null` to clear the allow-list, or
  omit to leave unchanged.

Returns:

- Updated workspace setting.

## GET /api/v1/workspaces/:workspaceId/tasks

Lists a page of tasks in a workspace.

Path parameters:

- `workspaceId`: The workspace id whose tasks should be listed.

Query parameters:

- `afterLastContinuedAt`: Optional ISO timestamp cursor. When present, return
  tasks after this last-continued time.
- `limit`: Optional page size from 1 to 100. Defaults to 20.

Returns:

- Paged workspace task list.
