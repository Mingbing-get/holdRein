# Subagent Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist subagents as running at creation, mark them completed at their true terminal state, remove completed runtime entries from memory, and cascade-delete rows with their task.

**Architecture:** Add a Drizzle `subagents` table and a focused repository with SQLite and in-memory adapters. Inject the repository into `AgentRuntime`; generate the child ID before startup, persist it with rollback on startup failure, and update/delete runtime state only after the child declines continuation.

**Tech Stack:** Strict TypeScript, Drizzle ORM, SQLite, Vitest

---

### Task 1: Add the subagents database schema

**Files:**
- Modify: `apps/api/src/db/schema.ts`
- Modify: `apps/api/src/db/index.ts`
- Modify: `apps/api/src/db/migrate.ts`
- Test: `apps/api/src/db/database.test.ts`

- [x] **Step 1: Write failing schema and cascade tests**

Assert that the schema exports `subagents`, migration creates the strict table
and task index, invalid statuses are rejected, and deleting a task removes its
subagent rows.

- [x] **Step 2: Run database tests and verify RED**

Run `pnpm exec vitest run apps/api/src/db/database.test.ts` and confirm failure
because the table is absent.

- [x] **Step 3: Add the Drizzle model and migration SQL**

Define `agentId`, `parentAgentId`, `taskId`, `status`, `createdAt`, and
`updatedAt`; constrain status to `running | completed`, reference tasks with
`ON DELETE CASCADE`, and index `taskId`.

- [x] **Step 4: Run database tests and verify GREEN**

Run the focused database test and expect all cases to pass.

### Task 2: Add a dedicated subagent repository

**Files:**
- Create: `apps/api/src/modules/agents/subagent-repository.ts`
- Create: `apps/api/src/modules/agents/subagent-repository.test.ts`

- [x] **Step 1: Write failing repository contract tests**

Cover create/find, status update with timestamp, delete rollback, and identical
behavior for in-memory and SQLite adapters.

- [x] **Step 2: Verify RED**

Run the new repository test and confirm the module/API is missing.

- [x] **Step 3: Implement the minimal repository**

Expose explicit `create`, `delete`, `findByAgentId`, and `updateStatus`
operations. Keep timestamps supplied by the runtime for deterministic tests.

- [x] **Step 4: Verify GREEN**

Run the repository test and expect both adapters to pass.

### Task 3: Persist the runtime lifecycle

**Files:**
- Modify: `apps/api/src/modules/agents/agent-runtime.ts`
- Modify: `apps/api/src/modules/agents/agent-runtime-test-utils.ts`
- Modify: `apps/api/src/modules/agents/agent-runtime.test.ts`
- Modify: `apps/api/src/modules/agents/default-agents-service.ts`

- [x] **Step 1: Extend the existing lifecycle test before implementation**

Assert `running` immediately after child creation, still `running` after a
child continuation, `completed` after the terminal child end, and no duplicate
parent continuation when the terminal event is processed again.

- [x] **Step 2: Add a startup rollback test**

Force synchronous child harness creation to fail and assert that the newly
created database row is deleted.

- [x] **Step 3: Run focused runtime tests and verify RED**

Run `pnpm exec vitest run apps/api/src/modules/agents/agent-runtime.test.ts`.

- [x] **Step 4: Inject and use `SubagentRepository`**

Generate the child ID before startup, create the running row, pass the ID into
`startHarness`, and delete the row if synchronous startup fails. At terminal
completion, persist `completed`, delete the entry from the runtime map, then
resume the parent.

- [x] **Step 5: Wire the SQLite adapter in production**

Create the workspace and subagent repositories from the same application
database and pass the latter to `createAgentRuntime`.

- [x] **Step 6: Verify GREEN and regressions**

Run API typecheck, database tests, repository tests, and all agents module
tests. Run `git diff --check` and verify every edited file remains at or below
500 lines.
