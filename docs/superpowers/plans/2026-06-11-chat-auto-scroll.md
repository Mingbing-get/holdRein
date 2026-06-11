# Chat Auto Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the active chat at its newest content while respecting a user who manually scrolls away from the bottom.

**Architecture:** `ChatWorkspace` owns a ref to its scroll container, a bottom sentinel, and a mutable follow-state flag. Task changes force a scroll to the sentinel; message changes scroll only while following; trusted user scroll events update following based on the container's bottom distance.

**Tech Stack:** React 19, strict TypeScript, Ant Design Flex, Vitest, Testing Library

---

### Task 1: Add chat auto-scroll behavior

**Files:**
- Modify: `apps/web/src/modules/chat/chat-workspace.test.tsx`
- Modify: `apps/web/src/modules/chat/chat-workspace.tsx`

- [ ] **Step 1: Write failing tests**

Add a stateful `AgentMessageList` mock and tests covering initial task entry,
message updates while following, pausing after a trusted user scroll away from
the bottom, resuming after returning to the bottom, and ignoring untrusted
scroll events.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run apps/web/src/modules/chat/chat-workspace.test.tsx`

Expected: FAIL because the bottom sentinel and scroll-follow behavior do not
exist.

- [ ] **Step 3: Implement minimal behavior**

In `ChatWorkspace`, add refs for the scroll container, bottom sentinel, active
task, and follow state. Add a trusted scroll handler that measures whether the
container is at the bottom. Add effects that force scroll on task changes and
conditionally scroll on message changes.

- [ ] **Step 4: Run focused tests**

Run: `pnpm exec vitest run apps/web/src/modules/chat/chat-workspace.test.tsx`

Expected: PASS.

- [ ] **Step 5: Run web verification**

Run: `pnpm exec vitest run apps/web/src/modules/chat`

Expected: PASS.

Run: `pnpm --filter @hold-rein/web build`

Expected: PASS.
