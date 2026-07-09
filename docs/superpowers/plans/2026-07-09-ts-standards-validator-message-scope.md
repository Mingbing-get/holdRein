# ts-standards Validator Message Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate all work after the previous validator run and preserve enough task context for repeated validation.

**Architecture:** Scope changed-file extraction only by the latest validator marker. Aggregate user text from that window when present; otherwise combine the latest user message from full history with the previous validator result.

**Tech Stack:** Strict TypeScript, Vitest, Vite, pnpm via Corepack.

---

### Task 1: Specify the validation message window

**Files:**
- Modify: `packages/plugins/ts-standards/src/server.test.ts`
- Modify: `packages/plugins/ts-standards/src/server.ts`

- [ ] Add a plugin-level regression test with a previous validator marker, an empty user message, an original task, an interrupted run, a `继续` message, and successful file changes across both runs.
- [ ] Run `corepack pnpm exec vitest run packages/plugins/ts-standards/src/server.test.ts` and verify the test fails because the prompt only contains the latest `runInput.prompt`.
- [ ] Add a helper that returns messages from the first non-empty textual user message after the latest validator marker.
- [ ] Use the scoped messages for changed-file extraction.

### Task 2: Aggregate original user instructions

**Files:**
- Modify: `packages/plugins/ts-standards/src/server.test.ts`
- Modify: `packages/plugins/ts-standards/src/server.ts`

- [ ] Extend the regression test to require string and structured user text messages in order, separated by `\n`, with empty and non-text entries ignored.
- [ ] Run the focused test and verify it fails because user messages are not aggregated.
- [ ] Add explicit text-extraction helpers and pass the joined text to `createValidationPrompt`.
- [ ] Run the focused test and verify it passes.

### Task 3: Verify the package

**Files:**
- Verify: `packages/plugins/ts-standards/src/server.ts`
- Verify: `packages/plugins/ts-standards/src/server.test.ts`

- [ ] Run `corepack pnpm exec vitest run packages/plugins/ts-standards/src/server.test.ts`.
- [ ] Run `corepack pnpm --filter @hold-rein/plugins-ts-standards typecheck`.
- [ ] Run the repository ESLint command applicable to the changed files.
- [ ] Confirm both source files remain at or below 500 lines.
