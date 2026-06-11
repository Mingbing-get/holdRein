# Workspace Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add workspace new-conversation and safe delete actions to the web sidebar.

**Architecture:** The workspace service owns deletion policy and session-file cleanup, while the repository owns database removal. The web workspace context owns deterministic selection fallback after deletion, and the workspace section owns the Ant Design hover menu and confirmation flow.

**Tech Stack:** Strict TypeScript, Express, Drizzle SQLite, React, Ant Design, Vitest, Testing Library

---

### Task 1: Workspace Delete Repository And Service

**Files:**
- Modify: `apps/api/src/modules/workspaces/workspace-repository.ts`
- Modify: `apps/api/src/modules/workspaces/workspaces-service.ts`
- Create: `apps/api/src/modules/workspaces/workspaces-service.test.ts`

- [ ] **Step 1: Write failing service tests**

Add tests that seed completed and running tasks, create temporary session files,
and assert that `deleteWorkspace()`:

```ts
await expect(service.deleteWorkspace("workspace-one")).resolves.toEqual({
  status: "deleted",
  workspaceId: "workspace-one"
});
expect(repository.findWorkspaceById("workspace-one")).toBeUndefined();
expect(repository.findTaskById("task-one")).toBeUndefined();
```

Also assert missing session files are accepted, non-missing file errors leave
database records intact, running tasks return `{ status: "has_running_tasks" }`,
and unknown ids return `{ status: "not_found" }`.

- [ ] **Step 2: Verify the service tests fail**

Run: `pnpm test apps/api/src/modules/workspaces/workspaces-service.test.ts`

Expected: FAIL because `deleteWorkspace` and repository delete methods do not
exist.

- [ ] **Step 3: Implement repository and service deletion**

Add explicit repository methods:

```ts
deleteTasksByWorkspaceId(workspaceId: string): void;
deleteWorkspaceById(workspaceId: string): void;
listAllTasksByWorkspaceId(workspaceId: string): TaskRow[];
```

Add async service deletion using `node:fs/promises.unlink`. Ignore only
`ENOENT`, reject workspaces with a running task, delete session files before
database rows, and never touch `workspace.path`.

- [ ] **Step 4: Verify the service tests pass**

Run: `pnpm test apps/api/src/modules/workspaces/workspaces-service.test.ts`

Expected: PASS.

### Task 2: Workspace Delete HTTP Contract

**Files:**
- Modify: `apps/api/src/response/response-codes.ts`
- Modify: `apps/api/src/modules/workspaces/workspaces-router.ts`
- Modify: `apps/api/src/modules/workspaces/workspaces-router.test.ts`

- [ ] **Step 1: Write failing route tests**

Add tests for:

```ts
DELETE /api/v1/workspaces/workspace-alpha
```

Expect HTTP 200 with `{ workspaceId: "workspace-alpha" }`, HTTP 404 for an
unknown workspace, and HTTP 409 with a running-task-specific message.

- [ ] **Step 2: Verify route tests fail**

Run: `pnpm test apps/api/src/modules/workspaces/workspaces-router.test.ts`

Expected: FAIL because the DELETE route and conflict response code are absent.

- [ ] **Step 3: Implement the route**

Add a `conflict` response definition and an async DELETE handler that maps
service results to success, not-found, and conflict responses. Forward
unexpected file deletion failures to the existing error middleware.

- [ ] **Step 4: Verify route tests pass**

Run: `pnpm test apps/api/src/modules/workspaces/workspaces-router.test.ts`

Expected: PASS.

### Task 3: Browser Workspace Selection And API

**Files:**
- Modify: `apps/web/src/app/app-workspace-context.tsx`
- Modify: `apps/web/src/app/app-workspace-context.test.tsx`
- Modify: `apps/web/src/modules/leftSide/workspace-nav-api.ts`
- Create: `apps/web/src/modules/leftSide/workspace-nav-api.test.ts`

- [ ] **Step 1: Write failing browser state and API tests**

Test that `startNewConversation(workspaceId)` selects that workspace and clears
the task. Test that `removeWorkspace(workspaceId)` preserves inactive
selection, falls back to the first remaining workspace and task, selects an
empty first workspace with no task, or clears both ids.

Test that:

```ts
deleteWorkspace("http://localhost:4000", "workspace-one")
```

sends `DELETE` to `/api/v1/workspaces/workspace-one` and exposes the API error
message on failure.

- [ ] **Step 2: Verify browser state and API tests fail**

Run: `pnpm test apps/web/src/app/app-workspace-context.test.tsx apps/web/src/modules/leftSide/workspace-nav-api.test.ts`

Expected: FAIL because the new context operations and API function are absent.

- [ ] **Step 3: Implement browser state and API**

Change `startNewConversation` to accept a workspace id. Add `removeWorkspace`
with deterministic fallback selection and local-storage synchronization. Add
the typed delete API function.

- [ ] **Step 4: Verify browser state and API tests pass**

Run: `pnpm test apps/web/src/app/app-workspace-context.test.tsx apps/web/src/modules/leftSide/workspace-nav-api.test.ts`

Expected: PASS.

### Task 4: Workspace Hover Actions

**Files:**
- Modify: `apps/web/src/modules/leftSide/workspace-nav/index.tsx`
- Modify: `apps/web/src/modules/leftSide/workspace-section/index.tsx`
- Modify: `apps/web/src/modules/leftSide/workspace-section/index.test.tsx`

- [ ] **Step 1: Write failing interaction tests**

Test that the three-dot action trigger is absent before workspace-heading hover,
appears on hover, and opens menu items with plus/delete icons. Test that new
conversation selects the target workspace and clears the task. Test that delete
opens a confirmation modal, calls the API only after confirmation, removes the
workspace after success, and preserves it after failure.

- [ ] **Step 2: Verify interaction tests fail**

Run: `pnpm test apps/web/src/modules/leftSide/workspace-section/index.test.tsx`

Expected: FAIL because workspace actions are not rendered.

- [ ] **Step 3: Implement the Ant Design interactions**

Pass `apiBaseUrl` through `WorkspaceNav` to each section. Use Ant Design
`Dropdown`, icon buttons, and `Modal.confirm`; stop propagation so action
clicks do not collapse the workspace. Use `message.error` for delete failures.

- [ ] **Step 4: Verify interaction tests pass**

Run: `pnpm test apps/web/src/modules/leftSide/workspace-section/index.test.tsx apps/web/src/modules/leftSide/workspace-nav/index.test.tsx`

Expected: PASS.

### Task 5: Full Verification

**Files:**
- Modify only if verification reveals a scoped issue.

- [ ] **Step 1: Run focused workspace tests**

Run: `pnpm test apps/api/src/modules/workspaces apps/web/src/modules/leftSide apps/web/src/app/app-workspace-context.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run repository verification**

Run: `pnpm test`

Run: `pnpm typecheck`

Run: `pnpm lint`

Run: `pnpm build`

Expected: all commands PASS and all edited files remain at or below 500 lines.
