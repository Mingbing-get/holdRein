# Task Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sidebar task rename and delete actions backed by task mutation APIs.

**Architecture:** Extend the existing agents router/service for individual task
mutations, add a repository task deletion primitive, and connect these APIs to
the existing workspace sidebar and app workspace context.

**Tech Stack:** TypeScript, React, Ant Design, Express, Drizzle, Vitest,
Testing Library

---

### Task 1: Backend task mutations

**Files:**
- Modify: `apps/api/src/modules/workspaces/workspace-repository.ts`
- Modify: `apps/api/src/modules/agents/agents-service.ts`
- Modify: `apps/api/src/modules/agents/agents-router.ts`
- Test: `apps/api/src/modules/agents/agents-service.test.ts`
- Test: `apps/api/src/modules/agents/agents-router.test.ts`

- [ ] Add failing tests for title updates, task deletion, session file removal,
  running-task conflict, missing task, and invalid title.
- [ ] Run focused backend tests and verify the new cases fail.
- [ ] Implement repository, service, and router behavior.
- [ ] Run focused backend tests and verify they pass.

### Task 2: Frontend request and state behavior

**Files:**
- Modify: `apps/web/src/modules/leftSide/workspace-nav-api.ts`
- Modify: `apps/web/src/app/app-workspace-context.tsx`
- Test: `apps/web/src/modules/leftSide/workspace-nav-api.test.ts`
- Test: `apps/web/src/app/app-workspace-actions.test.tsx`

- [ ] Add failing tests for rename/delete requests and removing active or
  inactive tasks.
- [ ] Run focused frontend tests and verify the new cases fail.
- [ ] Implement request helpers and task removal state transition.
- [ ] Run focused frontend tests and verify they pass.

### Task 3: Sidebar task actions

**Files:**
- Modify: `apps/web/src/modules/leftSide/workspace-section/index.tsx`
- Test: `apps/web/src/modules/leftSide/workspace-section/index.test.tsx`

- [ ] Add failing tests for the hover action button, rename modal, delete
  confirmation, successful local updates, and conflict feedback.
- [ ] Run focused component tests and verify the new cases fail.
- [ ] Implement the task action menu and modal flows with Ant Design.
- [ ] Run focused component tests and verify they pass.

### Task 4: Verification

- [ ] Run `pnpm test`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm build`.
