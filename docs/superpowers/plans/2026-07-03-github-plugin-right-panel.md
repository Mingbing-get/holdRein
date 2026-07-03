# GitHub Plugin Right Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Git-aware right panel to the GitHub plugin with repository initialization, status, local branch switching, committing, and optional pushing.

**Architecture:** A plugin-local Git service wraps `simple-git` and exposes typed operations through plugin-owned Express routes. A factory-built React right panel consumes those routes and treats the server response as authoritative, using Ant Design controls and application theme variables.

**Tech Stack:** strict TypeScript, Express 5, simple-git, React 19, Ant Design 6, Vitest, Testing Library, Vite, ESLint

---

## File Map

- Modify `packages/plugins/github/package.json`: add runtime/test dependencies and a test script if needed.
- Modify `packages/plugins/github/src/server.ts`: register the plugin router.
- Create `packages/plugins/github/src/server/git-service.ts`: typed Git status and mutation operations.
- Create `packages/plugins/github/src/server/git-service.test.ts`: real temporary-repository behavior tests.
- Create `packages/plugins/github/src/server/routes.ts`: validate HTTP input and map service errors to plugin responses.
- Create `packages/plugins/github/src/server/routes.test.ts`: route contract tests.
- Modify `packages/plugins/github/src/web.ts`: register the right-panel contribution.
- Create `packages/plugins/github/src/web/git-panel/types.ts`: shared web response types.
- Create `packages/plugins/github/src/web/git-panel/create-git-panel.tsx`: right-panel descriptor and request injection.
- Create `packages/plugins/github/src/web/git-panel/git-panel.tsx`: status and mutation UI.
- Create `packages/plugins/github/src/web/git-panel/git-panel.css`: app-variable-only layout styles.
- Create `packages/plugins/github/src/web/git-panel/index.ts`: public exports.
- Create `packages/plugins/github/src/web/git-panel/git-panel.test.tsx`: contribution and interaction tests.
- Modify `pnpm-lock.yaml`: lock `simple-git` and package metadata.

### Task 1: Git service status

- [ ] Write failing tests in `git-service.test.ts` for a non-repository and a repository with local branches, staged/unstaged/untracked files, and aggregate line counts.
- [ ] Run `corepack pnpm exec vitest run packages/plugins/github/src/server/git-service.test.ts` and verify failure because the service is missing.
- [ ] Add `simple-git` to the plugin with `corepack pnpm --filter @hold-rein/plugins-github add simple-git`.
- [ ] Implement explicit `GitRepositoryStatus`, `GitService`, and `createGitService(workspacePath)` APIs in `git-service.ts`.
- [ ] Use `checkIsRepo`, `status`, `branchLocal`, and numstat output; count untracked text lines while treating binary files as zero-line entries.
- [ ] Re-run the focused tests and verify they pass.

### Task 2: Git service mutations

- [ ] Add failing tests for initialization, dirty branch rejection, clean branch switching, empty commit rejection, commit success, commit-and-push order, and push failure preserving the local commit.
- [ ] Run the focused test and verify the new cases fail for missing behavior.
- [ ] Implement `initialize`, `switchBranch`, and `commit` methods. Re-read status immediately before switch/commit; use simple-git argument APIs without shell command construction.
- [ ] Re-run the service tests and verify all pass.
- [ ] Commit the self-contained service slice.

### Task 3: Plugin HTTP routes

- [ ] Write failing route tests for `GET /status`, `POST /initialize`, `POST /branches/switch`, and `POST /commits`, including missing/invalid bodies and conflict mapping.
- [ ] Run `corepack pnpm exec vitest run packages/plugins/github/src/server/routes.test.ts` and verify failure because routes are absent.
- [ ] Implement `routes.ts` with narrow request parsers, required absolute workspace paths, stable response codes, and injectable Git-service factory only for the external adapter boundary used by route tests.
- [ ] Register the router from `server.ts`.
- [ ] Re-run route and service tests and verify all pass.

### Task 4: Right-panel contribution and state rendering

- [ ] Query Ant Design 6 APIs with `antd info`/`antd demo` for Button, Dropdown, Collapse, Modal, Input, and Alert before writing UI code.
- [ ] Write failing web tests proving the contribution is wired, no request occurs without a workspace, initial status loads with the workspace path, uninitialized state initializes Git, and manual refresh repeats the status request.
- [ ] Run `corepack pnpm exec vitest run packages/plugins/github/src/web/git-panel/git-panel.test.tsx` and verify failure because the panel is missing.
- [ ] Implement the typed factory, exports, web contribution registration, loading/error/empty states, initialization, and refresh behavior.
- [ ] Add focused CSS using only existing `--app-*` theme variables.
- [ ] Re-run the web tests and verify this slice passes.

### Task 5: Branch, changes, and commit interactions

- [ ] Add failing web tests for alternate local branches, dirty-state branch disabling, clean branch switching, non-expandable clean changes, expanded relative paths, required commit messages, commit, commit-and-push, pending buttons, preserved modal state on failure, and status refresh after success.
- [ ] Run the focused web test and verify failures correspond to missing interactions.
- [ ] Implement the Ant Design branch dropdown, accessible change disclosure, commit modal, request payloads, pending guards, success/error messages, and authoritative reloads.
- [ ] Re-run the web tests and verify all pass.
- [ ] Keep every source file below 500 lines by extracting focused hooks or components if necessary.

### Task 6: Package verification

- [ ] Run `corepack pnpm exec vitest run packages/plugins/github/src` and fix any failures.
- [ ] Run `corepack pnpm --filter @hold-rein/plugins-github typecheck` and fix strict TypeScript errors.
- [ ] Run `corepack pnpm exec eslint packages/plugins/github` and fix lint errors.
- [ ] Run `corepack pnpm --filter @hold-rein/plugins-github build` and verify both server and web bundles succeed.
- [ ] Run `git diff --check` and confirm all source files are at most 500 lines.
- [ ] Review `git diff` for unrelated changes, then commit the implementation.
