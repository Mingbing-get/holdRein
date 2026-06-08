# Web Agent Task Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the web sender to agent task startup, globally receive task events, update workspace navigation, and render normalized messages by task.

**Architecture:** Keep low-frequency workspace navigation in `AppWorkspaceProvider` and introduce a root-level `AgentTasksProvider` for task-indexed messages, runs, and NDJSON subscriptions. Normalize events independently from React renderers, and let chat components consume only the active task state.

**Tech Stack:** TypeScript, React 19, Ant Design, Ant Design X, Fetch streaming, Vitest, Testing Library, Vite

---

### Task 1: Workspace Task Navigation Updates

**Files:**
- Modify: `apps/web/src/app/app-workspace-context.tsx`
- Modify: `apps/web/src/app/app-workspace-context.test.tsx`
- Modify: `apps/web/src/modules/LeftSide/workspace-section/index.tsx`
- Modify: `apps/web/src/modules/LeftSide/workspace-section/index.test.tsx`

- [ ] Write failing tests showing a started task is inserted at the front with the prompt as its temporary title, and a generated title later replaces it.
- [ ] Run `pnpm exec vitest run apps/web/src/app/app-workspace-context.test.tsx apps/web/src/modules/LeftSide/workspace-section/index.test.tsx` and verify the new tests fail.
- [ ] Add explicit `upsertStartedTask` and `updateTaskTitle` workspace context operations and navigation title fallback behavior.
- [ ] Run the focused tests and verify they pass.

### Task 2: Agent Message Model And API

**Files:**
- Create: `apps/web/src/modules/agent-messages/agent-message-types.ts`
- Create: `apps/web/src/modules/agent-messages/agent-message-api.ts`
- Create: `apps/web/src/modules/agent-messages/agent-message-api.test.ts`
- Create: `apps/web/src/modules/agent-messages/agent-message-reducer.ts`
- Create: `apps/web/src/modules/agent-messages/agent-message-reducer.test.ts`

- [ ] Write failing tests for start/title request contracts, partial NDJSON parsing, and event normalization.
- [ ] Run the focused tests and verify they fail because the modules do not exist.
- [ ] Implement strict public types, streaming NDJSON parsing, and a pure task message reducer.
- [ ] Run the focused tests and verify they pass.

### Task 3: Global Agent Task Provider

**Files:**
- Create: `apps/web/src/modules/agent-messages/agent-tasks-context.tsx`
- Create: `apps/web/src/modules/agent-messages/agent-tasks-context.test.tsx`
- Create: `apps/web/src/modules/agent-messages/index.ts`
- Modify: `apps/web/src/App.tsx`

- [ ] Write failing provider tests showing task startup updates navigation, receives events after chat consumers unmount, and replaces the temporary title.
- [ ] Run the provider tests and verify they fail.
- [ ] Implement `AgentTasksProvider`, root provider wiring, run subscription lifecycle, and task-focused public operations.
- [ ] Run the provider tests and verify they pass.

### Task 4: Independent Message Renderers

**Files:**
- Create: `apps/web/src/modules/agent-messages/message-list.tsx`
- Create: `apps/web/src/modules/agent-messages/message-list.test.tsx`
- Create: `apps/web/src/modules/agent-messages/renderers/user-message.tsx`
- Create: `apps/web/src/modules/agent-messages/renderers/assistant-message.tsx`
- Create: `apps/web/src/modules/agent-messages/renderers/thinking-message.tsx`
- Create: `apps/web/src/modules/agent-messages/renderers/tool-message.tsx`
- Create: `apps/web/src/modules/agent-messages/renderers/approval-message.tsx`
- Create: `apps/web/src/modules/agent-messages/renderers/fallback-message.tsx`

- [ ] Write failing tests for rendering each normalized message kind.
- [ ] Run the message list tests and verify they fail.
- [ ] Implement renderer-only components with application theme variables.
- [ ] Run the message list tests and verify they pass.

### Task 5: Chat Sender Integration

**Files:**
- Modify: `apps/web/src/modules/chat/chat-workspace.tsx`
- Modify: `apps/web/src/modules/chat/chat-workspace.test.tsx`
- Modify: `apps/web/src/modules/shell/hold-rein-shell.tsx`
- Modify: `apps/web/src/modules/chat/sender/index.tsx`
- Modify: `apps/web/src/modules/chat/sender/index.test.tsx`

- [ ] Write failing tests showing sender submission starts a task, preserves input on failure, and renders the active task's messages.
- [ ] Run the focused chat and sender tests and verify they fail.
- [ ] Replace example messages with `AgentMessageList`, connect submission to `startTask`, and only clear the sender after successful submission.
- [ ] Run focused chat and sender tests and verify they pass.

### Task 6: Verification

**Files:**
- Modify only files required by verification failures.

- [ ] Run `pnpm exec vitest run apps/web/src`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm --filter @hold-rein/web typecheck`.
- [ ] Run `pnpm exec eslint apps/web/src`.
- [ ] Run `pnpm --filter @hold-rein/web build`.
- [ ] Run `git diff --check` and confirm every modified source file remains at or below 500 lines.
