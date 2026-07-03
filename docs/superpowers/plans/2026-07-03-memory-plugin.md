# Memory Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add workspace-backed memory injection and low-priority end-of-task memory organization to the memory plugin.

**Architecture:** Keep the public plugin entry small and move prompt construction and memory loading into focused modules. Resolve the index from the runtime workspace, inject it into all agents except the organizer, and expose a main-only final continuation containing the complete transcript.

**Tech Stack:** Strict TypeScript, Node.js filesystem/path APIs, Vitest, Vite

---

### Task 1: Specify memory injection behavior

**Files:**
- Create: `packages/plugins/memory/src/server.test.ts`
- Modify: `packages/plugins/memory/src/server.ts`
- Create: `packages/plugins/memory/src/server/memory-context.ts`

- [ ] **Step 1: Write failing tests**

Add tests resolving contributions for a regular agent, a missing index, and the
`memory-organizer`. Assert directory guidance, verbatim index inclusion, graceful
fallback, and organizer exclusion.

- [ ] **Step 2: Run tests and verify RED**

Run: `corepack pnpm exec vitest run packages/plugins/memory/src/server.test.ts`

Expected: FAIL because the plugin has no contribution resolver.

- [ ] **Step 3: Implement minimal memory context loading**

Add a focused module that reads `.hold-rein/memories/index.md`, catches read
errors, and builds the system prompt. Wire it through the plugin contribution
resolver while excluding the organizer agent name.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `corepack pnpm exec vitest run packages/plugins/memory/src/server.test.ts`

Expected: PASS.

### Task 2: Specify final memory organization behavior

**Files:**
- Modify: `packages/plugins/memory/src/server.test.ts`
- Modify: `packages/plugins/memory/src/server.ts`
- Create: `packages/plugins/memory/src/server/organizer-prompt.ts`

- [ ] **Step 1: Write failing tests**

Assert that only the main agent gets an end handler, its priority is `-9999`, and
the returned continuation uses the organizer subagent name and includes all
messages plus file-layout, conflict-resolution, importance, and tool guidance.

- [ ] **Step 2: Run tests and verify RED**

Run: `corepack pnpm exec vitest run packages/plugins/memory/src/server.test.ts`

Expected: FAIL because no organizer continuation exists.

- [ ] **Step 3: Implement minimal organizer continuation**

Build a deterministic organizer prompt around `JSON.stringify(input.messages,
null, 2)` and return it from the main-only end handler with `useSubagent: true`.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `corepack pnpm exec vitest run packages/plugins/memory/src/server.test.ts`

Expected: PASS.

### Task 3: Verify package quality

**Files:**
- Review: `packages/plugins/memory/src/**/*.ts`

- [ ] **Step 1: Run focused tests**

Run: `corepack pnpm exec vitest run packages/plugins/memory/src/server.test.ts`

- [ ] **Step 2: Run package type checking**

Run: `corepack pnpm --filter @hold-rein/plugins-memory typecheck`

- [ ] **Step 3: Run lint on changed source files**

Run: `corepack pnpm exec eslint packages/plugins/memory/src`

- [ ] **Step 4: Build the package**

Run: `corepack pnpm --filter @hold-rein/plugins-memory build`

- [ ] **Step 5: Inspect the final diff and file sizes**

Confirm all files remain below 500 lines and no unrelated files changed.
