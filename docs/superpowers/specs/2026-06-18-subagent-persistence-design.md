# Subagent Persistence Design

## Goal

Persist each child agent from creation through completion while keeping active
runtime objects in memory only for as long as they are needed.

## Data Model

Add a strict SQLite `subagents` table with:

- `agent_id` as the primary key.
- `parent_agent_id` for the runtime parent relationship.
- `task_id` referencing `tasks.id` with `ON DELETE CASCADE`.
- `status` constrained to `running` or `completed`.
- `created_at` and `updated_at` timestamps.

Index `task_id` for task-scoped deletion and future queries.

## Repository Boundary

Introduce a dedicated `SubagentRepository` rather than extending the workspace
repository. Provide SQLite and in-memory implementations with three operations:

- Create a running subagent row.
- Update a row's status and timestamp.
- Delete a row when startup must be rolled back.

The repository is an explicit runtime dependency because it is a
project-specific persistence adapter, not a Node built-in capability.

## Lifecycle

The runtime generates the child `agentId` before startup and persists a
`running` row. It then starts the child harness with that ID. A synchronous
startup failure deletes the newly inserted row before propagating the error.

When the child reaches a real terminal state—its own `onAgentEnd` returns no
continuation—the runtime updates the database row to `completed`, removes the
child from the in-memory map, and only then resumes its parent. A continuation
keeps both the database row and in-memory entry in `running` state.

Deleting a task removes all its subagent rows through the database foreign-key
cascade. Process-restart recovery of stale `running` rows is outside this
change's scope.

## Tests

- Schema creation, constraints, task index, and delete cascade.
- In-memory and SQLite repository create/update/delete behavior.
- Runtime persistence at child creation.
- Startup-failure rollback.
- Completion update followed by removal from the runtime map, demonstrated by
  parent resumption and no duplicate completion processing.
- Child continuation leaves the persisted status as `running`.

