# Scheduled Task Source Indicator Design

## Goal

Expose each task's `sourceType` and `sourceMark` through both workspace task-list
endpoints, then mark scheduled-task runs with a clock icon in the workspace task
navigation.

## Data flow

Both `GET /workspaces/recent-tasks` and
`GET /workspaces/:workspaceId/tasks` already map database task rows through the
shared `toTaskSummary` function. Extend the public API summary type and this
mapper with `sourceType` and `sourceMark`, then mirror those explicit fields in
the web navigation type.

## Rendering

`WorkspaceTask` renders `ClockCircleOutlined` immediately before the title when
`sourceType === "scheduled"`. Keep the icon as a separate flex item so title
ellipsis cannot hide it. Show it in both expanded and collapsed navigation.
Manual tasks do not render the icon.

## Testing

Following TDD, first add assertions that the shared API summary contains both
source fields and component tests that scheduled tasks show the icon in expanded
and collapsed modes while manual tasks do not. Run the focused API and web tests,
then the relevant package verification commands.
