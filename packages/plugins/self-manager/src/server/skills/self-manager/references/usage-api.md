# Usage API

Use these APIs when viewing model or task token usage. Call them through
`requestSelfApi`.

## GET /api/v1/usage-stats/models

Reads model token usage totals.

Query parameters:

- `range`: Usage time range. Use `"24h"` or `"30d"`. Defaults to `"24h"`.

Returns:

- Model usage stats for the selected range.

## GET /api/v1/usage-stats/tasks

Reads task token usage totals.

Query parameters:

- `range`: Usage time range. Use `"7d"` or `"30d"`. Defaults to `"7d"`.
- `groupBy`: Whether to group task usage by `"task"` or `"workspace"`.
  Defaults to `"task"`.

Returns:

- Task usage stats for the selected range and grouping.
