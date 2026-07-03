# Subagent Depth Limit Design

## Goal

Prevent model-driven subagent calls from recursively creating an unbounded agent tree. A main agent has depth `0`; ordinary subagents have depths `1`, `2`, and `3`. A harness at depth `3` or greater must not receive the `call_subagent` tool.

Plugin `onAgentEnd` continuations remain independent of this tool limit. When a continuation requests `useSubagent`, the runtime still starts it and records its actual depth, even when its parent is already at or beyond depth `3`. The resulting harness does not receive `call_subagent`.

## Data Model

Add a required integer `depth` column to the `subagents` table. New databases create it with a default of `1`, and existing databases add it through the idempotent migration path with the same default. The default preserves the safest useful interpretation of legacy rows, which represent children of a main agent but do not contain enough ancestry information for reliable reconstruction.

Expose `depth` explicitly on the persisted Drizzle row type, `SubagentRun`, and harness startup options. The main harness defaults to depth `0`. Child creation always calculates `childDepth = parentDepth + 1` and stores that value before starting the child harness. Resume/revoke reads the persisted child depth and passes it into the restored harness instead of recalculating it from an in-memory parent chain.

## Runtime Behavior

Tool assembly receives the current harness depth. It retains plugin, browser, and revoke tools at every depth, but only appends `call_subagent` when `depth < 3`.

Both ordinary `call_subagent` creation and `onAgentEnd` continuation creation propagate and persist `parentDepth + 1`. Direct continuation of the same harness preserves its existing depth. Resuming a completed subagent uses the database row's `depth`.

Because `runtime/index.ts` is already close to the 500-line project limit, depth/tool-selection logic should remain in the focused subagent runtime modules rather than expanding the central runtime with unrelated helpers.

## Failure Handling

Subagent rows continue to be deleted if harness startup fails. The new `depth` field is written in the same create operation, so there is no partially persisted depth state. Legacy rows receive depth `1` during migration.

## Tests

Tests are added before implementation and must first fail for the missing behavior. Coverage includes:

- main, depth-1, and depth-2 harnesses expose `call_subagent`;
- depth-3 and deeper harnesses do not expose `call_subagent`;
- ordinary and `onAgentEnd` child creation persist `parentDepth + 1`;
- `onAgentEnd` still creates a child when the parent is depth `3`;
- resumed subagents use their persisted depth when selecting tools;
- database creation and legacy migration produce a required `depth` column with the compatible default.

Focused Vitest suites, API TypeScript checking, and ESLint are run before completion.
