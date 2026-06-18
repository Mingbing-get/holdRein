# Task Subagent Message History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore every persisted child-agent conversation with its lifecycle status and subscribe only to children that are still running.

**Architecture:** Persist nullable session metadata on each subagent row, query all rows by task, and let the agents service load each child session into a structured history response. Normalize that response into status-aware web state keyed by `agentId`; live discovery creates running records, while completed restored records never open an event stream.

**Tech Stack:** Strict TypeScript, SQLite/Drizzle ORM, Express, React, Vitest, Vite.

---

## File Structure

- `apps/api/src/db/schema.ts`: add persisted subagent session columns.
- `apps/api/src/db/migrate.ts`: create/migrate the new nullable columns safely.
- `apps/api/src/db/database.test.ts`: verify fresh and existing database schemas.
- `apps/api/src/modules/agents/subagent-repository.ts`: expose task-scoped lookup.
- `apps/api/src/modules/agents/subagent-repository.test.ts`: cover session fields and task lookup.
- `apps/api/src/modules/agents/agent-runtime.ts`: persist child session metadata before prompting.
- `apps/api/src/modules/agents/agent-runtime.test.ts`: verify runtime ordering, persistence, rollback, and status.
- `apps/api/src/modules/agents/agent-types.ts`: define the public structured history types.
- `apps/api/src/modules/agents/agents-service.ts`: assemble parent and child histories.
- `apps/api/src/modules/agents/agents-service.test.ts`: cover history loading and child failure isolation.
- `apps/api/src/modules/agents/default-agents-service.ts`: share the SQLite subagent repository with runtime and service.
- `apps/api/src/modules/agents/agents-router.test.ts`: assert the new response contract.
- `apps/web/src/modules/agent-messages/agent-message-types.ts`: define history DTO and status-aware child state.
- `apps/web/src/modules/agent-messages/agent-message-api.ts`: return the structured DTO.
- `apps/web/src/modules/agent-messages/agent-message-api.test.ts`: cover the new API shape.
- `apps/web/src/modules/agent-messages/subagent-message-store.ts`: initialize, discover, and reduce status-aware child records.
- `apps/web/src/modules/agent-messages/subagent-message-store.test.ts`: cover history initialization, discovery, and terminal status.
- `apps/web/src/modules/agent-messages/agent-tasks-context.tsx`: hydrate child state and conditionally subscribe.
- `apps/web/src/modules/agent-messages/agent-tasks-context.subagent.test.tsx`: verify restored messages and subscription decisions.

### Task 1: Persist subagent session metadata

- [ ] **Step 1: Write failing schema and repository tests**

Update `database.test.ts` to require `session_id`, `session_path`, and
`session_created_at` on `subagents`, including migration of a legacy table.
Update `subagent-repository.test.ts` so created rows contain session metadata and
`findByTaskId("task-1")` returns all task children but excludes other tasks.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm exec vitest run apps/api/src/db/database.test.ts apps/api/src/modules/agents/subagent-repository.test.ts
```

Expected: failures for missing columns, rejected session fields, and missing
`findByTaskId`.

- [ ] **Step 3: Add nullable schema columns and idempotent migrations**

Add to the Drizzle table:

```ts
sessionCreatedAt: text("session_created_at"),
sessionId: text("session_id"),
sessionPath: text("session_path"),
```

Add guarded `ALTER TABLE subagents ADD COLUMN ... TEXT` migrations, using the
existing duplicate-column migration pattern. Keep columns nullable for legacy
rows.

- [ ] **Step 4: Add repository task lookup**

Extend `SubagentRepository` with:

```ts
findByTaskId: (taskId: string) => SubagentRow[];
```

Implement it with a map filter in memory and `eq(subagents.taskId, taskId)` in
SQLite.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the Task 1 command again. Expected: all tests pass.

- [ ] **Step 6: Commit the persistence slice**

```bash
git add apps/api/src/db/schema.ts apps/api/src/db/migrate.ts apps/api/src/db/database.test.ts apps/api/src/modules/agents/subagent-repository.ts apps/api/src/modules/agents/subagent-repository.test.ts
git commit -m "feat(api): persist subagent sessions"
```

### Task 2: Store child session metadata at runtime

- [ ] **Step 1: Write failing runtime tests**

Extend `agent-runtime.test.ts` to assert that a started child row includes all
three session fields, the row exists before the child is prompted, a synchronous
harness startup failure deletes it, and continuation/completion retain the same
session metadata.

- [ ] **Step 2: Run the runtime tests and verify RED**

```bash
pnpm exec vitest run apps/api/src/modules/agents/agent-runtime.test.ts
```

Expected: the persisted row lacks session metadata and ordering assertion fails.

- [ ] **Step 3: Create the child session before starting its harness**

In the `callsubagent` callback:

1. Generate the child `agentId`.
2. Call `sessionRepo.create({ cwd: input.workspacePath })`.
3. Read `AgentSessionMetadata`.
4. Persist the running row with that metadata.
5. Call `startHarness` with the prepared session.
6. Delete the row if harness startup throws.

Do not change top-level session creation or continuation behavior.

- [ ] **Step 4: Run the runtime tests and verify GREEN**

Run the Task 2 command again. Expected: all tests pass.

- [ ] **Step 5: Commit the runtime slice**

```bash
git add apps/api/src/modules/agents/agent-runtime.ts apps/api/src/modules/agents/agent-runtime.test.ts
git commit -m "feat(api): retain child agent session metadata"
```

### Task 3: Return structured parent and child history

- [ ] **Step 1: Write failing service and router tests**

In `agents-service.test.ts`, seed running and completed descendant rows with
sessions and assert:

```ts
{
  messages: [parentMessage],
  subagents: [
    { agentId, parentAgentId, status, messages: [childMessage] }
  ]
}
```

Also assert a missing legacy session yields an empty child message array and a
single rejected child load does not discard siblings. Update the router mock and
assert its structured `data` object.

- [ ] **Step 2: Run service and router tests and verify RED**

```bash
pnpm exec vitest run apps/api/src/modules/agents/agents-service.test.ts apps/api/src/modules/agents/agents-router.test.ts
```

Expected: array/object contract mismatch and missing subagent repository option.

- [ ] **Step 3: Add explicit backend response types**

Add `TaskMessageHistory` and `TaskSubagentHistory` to `agent-types.ts`. Change
`AgentsService.listTaskMessages` to return `Promise<TaskMessageHistory>` and add
an optional `subagentRepository` service option with an in-memory default for
isolated tests. The production service must pass its SQLite repository
explicitly.

- [ ] **Step 4: Assemble history with isolated child reads**

Load parent messages as today, query `findByTaskId`, and map children with
`Promise.all`. Convert complete session columns to `AgentSessionMetadata`; return
empty messages for incomplete metadata or a failed child read. Always return the
child relationship and status.

- [ ] **Step 5: Share the default repository instance**

In `default-agents-service.ts`, create one SQLite subagent repository and pass it
to both `createAgentRuntime` and `createAgentsService`.

- [ ] **Step 6: Run service and router tests and verify GREEN**

Run the Task 3 command again. Expected: all tests pass.

- [ ] **Step 7: Commit the backend API slice**

```bash
git add apps/api/src/modules/agents/agent-types.ts apps/api/src/modules/agents/agents-service.ts apps/api/src/modules/agents/agents-service.test.ts apps/api/src/modules/agents/default-agents-service.ts apps/api/src/modules/agents/agents-router.test.ts
git commit -m "feat(api): return subagent message history"
```

### Task 4: Normalize restored subagent status in the web client

- [ ] **Step 1: Write failing API and store tests**

Update `agent-message-api.test.ts` to return and assert the structured history.
Create `subagent-message-store.test.ts` so restored records preserve messages,
`parentAgentId`, and status; live discovery initializes a running record without
overwriting restored completed state.

- [ ] **Step 2: Run focused web tests and verify RED**

```bash
pnpm exec vitest run apps/web/src/modules/agent-messages/agent-message-api.test.ts apps/web/src/modules/agent-messages/subagent-message-store.test.ts
```

Expected: DTO and state type mismatches.

- [ ] **Step 3: Add web DTO and state types**

Define:

```ts
interface TaskMessageHistory {
  messages: WebPlugin.AgentMessage[];
  subagents: TaskSubagentHistory[];
}

interface SubagentState {
  messages: WebPlugin.AgentMessage[];
  parentAgentId: string;
  status: "running" | "completed";
}

type SubagentStatesById = Record<string, SubagentState>;
```

Change `fetchTaskMessages` to return `TaskMessageHistory`.

- [ ] **Step 4: Refactor child store helpers**

Add an initializer from history, preserve existing records during discovery,
append events to `state.messages`, recursively discover descendants, and mark a
child completed on its terminal event. Keep `getSubagentMessages` returning an
empty list fallback so rendering consumers remain unchanged.

- [ ] **Step 5: Run focused web tests and verify GREEN**

Run the Task 4 command again. Expected: all tests pass.

- [ ] **Step 6: Commit the web state slice**

```bash
git add apps/web/src/modules/agent-messages/agent-message-types.ts apps/web/src/modules/agent-messages/agent-message-api.ts apps/web/src/modules/agent-messages/agent-message-api.test.ts apps/web/src/modules/agent-messages/subagent-message-store.ts apps/web/src/modules/agent-messages/subagent-message-store.test.ts
git commit -m "feat(web): restore subagent history state"
```

### Task 5: Subscribe only to running subagents

- [ ] **Step 1: Write failing provider tests**

Update existing history fixtures to the structured response. Add cases proving:

- completed child messages render without an `/events` request;
- running restored children open exactly one stream;
- live discovered children still subscribe;
- a child terminal event changes its local status and prevents resubscription;
- nested children follow the same rule independently.

- [ ] **Step 2: Run provider tests and verify RED**

```bash
pnpm exec vitest run apps/web/src/modules/agent-messages/agent-tasks-context.subagent.test.tsx apps/web/src/modules/agent-messages/agent-tasks-context.test.tsx
```

Expected: completed children still subscribe and structured history is not
hydrated.

- [ ] **Step 3: Hydrate and conditionally subscribe**

In `agent-tasks-context.tsx`, load `history.messages` into the parent task and
merge `history.subagents` into the child store. Iterate child records and call
`startAgentEventSubscription` only for `status === "running"`. Keep the existing
AbortController deduplication and provider cleanup.

- [ ] **Step 4: Run provider tests and verify GREEN**

Run the Task 5 command again. Expected: all tests pass.

- [ ] **Step 5: Commit the subscription slice**

```bash
git add apps/web/src/modules/agent-messages/agent-tasks-context.tsx apps/web/src/modules/agent-messages/agent-tasks-context.test.tsx apps/web/src/modules/agent-messages/agent-tasks-context.subagent.test.tsx
git commit -m "feat(web): subscribe only to running subagents"
```

### Task 6: Full verification

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Expected: all Vitest suites pass.

- [ ] **Step 2: Run strict type checking**

```bash
pnpm typecheck
```

Expected: API, web, and packages report no TypeScript errors.

- [ ] **Step 3: Run ESLint**

```bash
pnpm lint
```

Expected: no lint errors.

- [ ] **Step 4: Build all Vite/TypeScript packages**

```bash
pnpm build
```

Expected: all workspace builds succeed and generated `dist` artifacts remain
uncommitted.

- [ ] **Step 5: Check file sizes and worktree scope**

Verify every modified source file remains at or below 500 lines. Inspect
`git status --short` and `git diff --check`; preserve unrelated user changes.
