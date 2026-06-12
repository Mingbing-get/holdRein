# Web Approval Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show queued approvals in a dedicated chat-bottom panel, expose pending approvals in task navigation, and pass optional rejection reasons to the agent runtime.

**Architecture:** Extend the API approval decision into a structured result, then keep transient approval queues in each web task state. Render the oldest active-task approval through an isolated component while navigation observes whether each task has any pending approvals.

**Tech Stack:** Strict TypeScript, React 19, Ant Design 6, Express, Vitest, Testing Library

---

### Task 1: Backend Rejection Reason Contract

**Files:**
- Modify: `apps/api/src/modules/agents/agent-types.ts`
- Modify: `apps/api/src/modules/agents/agent-approval-store.ts`
- Modify: `apps/api/src/modules/agents/agent-runtime.ts`
- Modify: `apps/api/src/modules/agents/agents-router.ts`
- Test: `apps/api/src/modules/agents/agent-approval-store.test.ts`
- Test: `apps/api/src/modules/agents/agent-runtime.test.ts`
- Test: `apps/api/src/modules/agents/agents-router.test.ts`

- [ ] Add failing tests for optional reason forwarding, structured store decisions, and runtime denial reasons.
- [ ] Run focused API tests and verify the new assertions fail.
- [ ] Extend the decision types, validation, store resolution, and runtime block reason.
- [ ] Run focused API tests and verify they pass.

### Task 2: Web Approval Queue And Decision API

**Files:**
- Modify: `apps/web/src/modules/agent-messages/agent-message-types.ts`
- Modify: `apps/web/src/modules/agent-messages/agent-message-reducer.ts`
- Modify: `apps/web/src/modules/agent-messages/agent-message-api.ts`
- Modify: `apps/web/src/modules/agent-messages/agent-tasks-context.tsx`
- Test: `apps/web/src/modules/agent-messages/agent-message-reducer.test.ts`
- Test: `apps/web/src/modules/agent-messages/agent-message-api.test.ts`
- Test: `apps/web/src/modules/agent-messages/agent-tasks-context.test.tsx`

- [ ] Add failing tests for queue append/deduplication, request bodies, successful removal, and failed retention.
- [ ] Run focused web state/API tests and verify the new assertions fail.
- [ ] Add typed approval state, reducer actions, API request, and context operations.
- [ ] Run focused web state/API tests and verify they pass.

### Task 3: Approval Panel And Navigation Tag

**Files:**
- Create: `apps/web/src/modules/agent-messages/approval-panel.tsx`
- Create: `apps/web/src/modules/agent-messages/approval-panel.test.tsx`
- Modify: `apps/web/src/modules/agent-messages/index.ts`
- Modify: `apps/web/src/modules/chat/chat-workspace.tsx`
- Modify: `apps/web/src/modules/chat/chat-workspace.test.tsx`
- Modify: `apps/web/src/modules/leftSide/workspace-section/index.tsx`
- Modify: `apps/web/src/modules/leftSide/workspace-section/workspace-task.tsx`
- Modify: `apps/web/src/modules/leftSide/workspace-section/workspace-task.test.tsx`

- [ ] Query the Ant Design Button, Input, and Tag APIs used by the component.
- [ ] Add failing component, chat-placement, and Tag-order tests.
- [ ] Run focused UI tests and verify the new assertions fail.
- [ ] Implement the approval panel and wire it into chat and navigation.
- [ ] Run focused UI tests and verify they pass.

### Task 4: Full Verification

- [ ] Run `pnpm exec vitest run apps/api/src/modules/agents apps/web/src`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm --filter @hold-rein/web typecheck`.
- [ ] Run `pnpm exec eslint apps/api/src apps/web/src`.
- [ ] Run `pnpm --filter @hold-rein/web build`.
- [ ] Run `git diff --check`.
- [ ] Confirm every modified source file remains at or below 500 lines.
