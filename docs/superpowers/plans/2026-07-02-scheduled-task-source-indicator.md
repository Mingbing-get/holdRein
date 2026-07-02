# Scheduled Task Source Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return task source metadata from both workspace task-list APIs and show a persistent clock icon for scheduled-task runs in the workspace navigation.

**Architecture:** Extend the shared API task-summary contract and mapper so both endpoints receive the fields automatically. Mirror the contract in the web app and render a standalone Ant Design icon before scheduled task titles so ellipsis does not hide it.

**Tech Stack:** TypeScript, Express, React, Ant Design, Vitest, Testing Library, pnpm via Corepack

---

### Task 1: Expose task source metadata

**Files:**
- Modify: `apps/api/src/modules/workspaces/workspace-types.ts`
- Modify: `apps/api/src/modules/workspaces/workspaces-service.ts`
- Test: `apps/api/src/modules/workspaces/workspaces-service.test.ts`
- Test: `apps/api/src/modules/workspaces/workspaces-router.test.ts`

- [ ] Add `sourceType` and `sourceMark` expectations to the service and route tests for recent and paginated task summaries.
- [ ] Run the focused API tests and confirm they fail because the fields are missing.
- [ ] Add explicit source fields to `WorkspaceTaskSummary` and copy them in `toTaskSummary`.
- [ ] Re-run the focused API tests and confirm they pass.

### Task 2: Render the scheduled-task icon

**Files:**
- Modify: `apps/web/src/modules/leftSide/workspace-nav-types.ts`
- Modify: `apps/web/src/modules/leftSide/workspace-section/workspace-task.tsx`
- Test: `apps/web/src/modules/leftSide/workspace-section/workspace-task.test.tsx`

- [ ] Add tests proving scheduled tasks show the clock in expanded and collapsed modes and manual tasks do not.
- [ ] Run the focused component test and confirm it fails because the icon is missing.
- [ ] Query the installed Ant Design metadata as required, add source fields to the web contract, and render `ClockCircleOutlined` as a non-shrinking sibling before the title.
- [ ] Re-run the focused component test and confirm it passes.

### Task 3: Verification

**Files:**
- Verify all modified source and test files.

- [ ] Run focused API and web test files together.
- [ ] Run package type checks and lint commands exposed by the repository.
- [ ] Inspect the final diff for unrelated changes and confirm every modified file remains below 500 lines.
