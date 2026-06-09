# Task Message Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist recoverable Harness-shaped messages per task, restore them in the browser, and continue existing tasks with restored Harness context.

**Architecture:** A dedicated task-message repository stores sanitized recoverable messages. The runtime converts Harness lifecycle events into persisted messages and compact client stream events. The web state loads stored messages and merges assistant deltas into structured assistant content.

**Tech Stack:** TypeScript, Express, Drizzle SQLite, React, Fetch NDJSON, Vitest, Vite

---

### Task 1: Stored Message Schema And Repository

**Files:**
- Modify: `apps/api/src/db/schema.ts`
- Modify: `apps/api/src/db/migrate.ts`
- Modify: `apps/api/src/db/index.ts`
- Create: `apps/api/src/modules/agents/agent-message-repository.ts`
- Test: `apps/api/src/db/database.test.ts`
- Test: `apps/api/src/modules/agents/agent-message-repository.test.ts`

- [ ] Write failing schema and repository tests.
- [ ] Run focused tests and confirm expected failures.
- [ ] Add `task_messages` and ordered repository operations.
- [ ] Run focused tests.

### Task 2: Stored Message Conversion And Runtime Persistence

**Files:**
- Create: `apps/api/src/modules/agents/agent-message-storage.ts`
- Modify: `apps/api/src/modules/agents/agent-types.ts`
- Modify: `apps/api/src/modules/agents/agent-runtime.ts`
- Test: `apps/api/src/modules/agents/agent-message-storage.test.ts`
- Test: `apps/api/src/modules/agents/agent-runtime.test.ts`

- [ ] Write failing conversion and runtime event tests.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement sanitization, Harness restoration, compact events, and message-end persistence.
- [ ] Run focused tests.

### Task 3: History And Continue API

**Files:**
- Modify: `apps/api/src/modules/agents/agents-service.ts`
- Modify: `apps/api/src/modules/agents/agents-router.ts`
- Modify: `apps/api/src/modules/agents/default-agents-service.ts`
- Test: `apps/api/src/modules/agents/agents-service.test.ts`
- Test: `apps/api/src/modules/agents/agents-router.test.ts`

- [ ] Write failing history and continue tests.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement service and route contracts.
- [ ] Run focused tests.

### Task 4: Browser Harness-Shaped Messages

**Files:**
- Modify: `apps/web/src/modules/agent-messages/agent-message-types.ts`
- Modify: `apps/web/src/modules/agent-messages/agent-message-api.ts`
- Modify: `apps/web/src/modules/agent-messages/agent-message-reducer.ts`
- Modify: `apps/web/src/modules/agent-messages/agent-tasks-context.tsx`
- Modify: `apps/web/src/modules/agent-messages/message-list.tsx`
- Modify: `apps/web/src/modules/agent-messages/renderers/*.tsx`
- Modify: `apps/web/src/modules/chat/chat-workspace.tsx`
- Test: corresponding web tests

- [ ] Rewrite tests for structured messages, delta merging, history loading, and continue submission.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement structured browser state and renderers.
- [ ] Run focused tests.

### Task 5: Verification

- [ ] Run `pnpm test`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm build`.
