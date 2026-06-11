# Workspace Actions Design

## Goal

Add workspace-level actions to the web sidebar so a user can start a blank
conversation in a specific workspace or delete a workspace together with its
tasks and task session files.

Deleting a workspace must never delete the real project directory referenced by
the workspace path.

## Sidebar Interaction

An expanded workspace heading keeps its existing folder icon, name, and
collapse toggle. Its action trigger is hidden by default and appears at the
right side of the heading while the pointer is over the workspace heading.

The trigger uses a three-dot icon. Hovering or clicking the trigger opens an
Ant Design action menu containing:

- a plus icon followed by `新对话`;
- a delete icon followed by `删除`.

The action trigger and menu are not shown while the whole sidebar is collapsed,
because workspace headings are not rendered in that state.

Choosing `新对话` selects that workspace, clears the active task id, records the
workspace as the new-conversation workspace, and opens the chat view. The next
submitted message starts a new task under that workspace through the existing
new-task flow.

Choosing `删除` opens an Ant Design confirmation modal. The modal explains that
the workspace record, all tasks under it, and their conversation session files
will be deleted. The modal does not imply that project source files will be
deleted.

## Delete API And Service

The API exposes:

- `DELETE /api/v1/workspaces/:workspaceId`

The workspace service first verifies that the workspace exists. If any task in
the workspace has status `running`, the service refuses the whole operation and
the route returns an HTTP 409 conflict response.

For a deletable workspace, the service collects all non-empty task
`sessionPath` values and deletes those files. A missing session file is treated
as already deleted. Any other file deletion failure aborts the operation before
database records are removed.

After session files are removed, the repository deletes every task belonging to
the workspace and then deletes the workspace record. The real directory stored
in `workspace.path` is never removed or modified.

The delete operation returns a small success result containing the deleted
workspace id. An unknown workspace returns HTTP 404.

## Browser State After Delete

After the API confirms deletion, the browser removes the workspace from its
workspace list.

If the deleted workspace was not active, the active workspace and task remain
unchanged.

If the deleted workspace was active:

1. When another workspace remains, the browser selects the first workspace in
   the remaining list and selects its first task.
2. When that first workspace has no task, the browser selects the workspace and
   clears the active task id.
3. When no workspace remains, the browser clears both the active workspace id
   and active task id.

The selected workspace id continues to be persisted through the existing local
storage behavior.

## Error Handling

The confirmation modal remains open while deletion is pending. On success it
closes and the browser state is updated. On failure the workspace remains in
the sidebar and an Ant Design error message explains the failure. A running-task
conflict is presented as a specific message rather than a generic network
failure.

Repeated delete requests for an already deleted workspace receive the normal
unknown-workspace response and do not attempt additional file cleanup.

## Testing

Backend tests cover:

- deleting all workspace tasks and the workspace record;
- deleting task session files without deleting the real workspace directory;
- allowing missing session files;
- aborting database deletion on other session-file errors;
- rejecting deletion when any task is running;
- returning 404 for an unknown workspace and 409 for a running-task conflict.

Frontend tests cover:

- showing the three-dot trigger only while the workspace heading is hovered;
- rendering plus and delete icons before their action labels;
- selecting a workspace and clearing the active task for `新对话`;
- showing a confirmation modal before deletion;
- calling the delete API only after confirmation;
- removing a successfully deleted workspace;
- preserving selection when deleting an inactive workspace;
- selecting the first remaining workspace and its first task after deleting the
  active workspace;
- clearing only the task when the first remaining workspace has no task;
- clearing both selections when no workspace remains;
- preserving the workspace and selection after delete failures.
