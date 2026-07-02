# Cron Chinese Time Periods Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize valid Chinese cron descriptions so early-morning times use `午夜` and late-evening times use `晚上` everywhere in the web app.

**Architecture:** Add a pure formatter beside the reusable cron input and export it through that component folder's public API. The formatter remains the sole `cronstrue` integration point; the input, editor preview, and scheduled-task table consume it while retaining their current invalid-value fallbacks.

**Tech Stack:** React 19, strict TypeScript, cronstrue 3.24, Vitest, Testing Library, pnpm via Corepack.

---

### Task 1: Add the Chinese cron description formatter

**Files:**
- Create: `apps/web/src/components/cronExpressionInput/cron-description.ts`
- Create: `apps/web/src/components/cronExpressionInput/cron-description.test.ts`
- Modify: `apps/web/src/components/cronExpressionInput/index.ts`

- [ ] **Step 1: Write the failing boundary tests**

Test `describeCronExpression` with `19 0 * * *`, `59 5 * * *`, `0 6 * * *`,
`59 19 * * *`, `19 20 * * *`, and `59 23 * * *`. Expect respectively
`在午夜 0:19`, `在午夜 05:59`, `在上午 06:00`, `在下午 07:59`,
`在晚上 08:19`, and `在晚上 11:59`. Add `19 0,5,20,23 * * *` and assert
that every generated time token is normalized.

- [ ] **Step 2: Run the formatter test and verify RED**

Run:
`corepack pnpm exec vitest run apps/web/src/components/cronExpressionInput/cron-description.test.ts`

Expected: FAIL because `cron-description.ts` does not exist.

- [ ] **Step 3: Implement the minimal formatter**

Call `cronstrue.toString(expression, { locale: "zh_CN" })`, then replace every
`上午/下午 HH:mm` token. Convert `上午 12` to `午夜 0`, convert `上午 01` through
`上午 05` to `午夜 01` through `午夜 05`, and convert `下午 08` through
`下午 11` to `晚上 08` through `晚上 11`. Leave all other tokens unchanged.
Export the formatter from `index.ts`.

- [ ] **Step 4: Run the formatter test and verify GREEN**

Run:
`corepack pnpm exec vitest run apps/web/src/components/cronExpressionInput/cron-description.test.ts`

Expected: PASS.

### Task 2: Route every cron description through the formatter

**Files:**
- Modify: `apps/web/src/components/cronExpressionInput/cron-expression-input.tsx`
- Modify: `apps/web/src/components/cronExpressionInput/cron-expression-editor.tsx`
- Modify: `apps/web/src/components/cronExpressionInput/cron-expression-input.test.tsx`
- Modify: `apps/web/src/modules/scheduled-tasks/scheduled-tasks-view.tsx`
- Modify: `apps/web/src/modules/scheduled-tasks/scheduled-tasks-view.test.tsx`

- [ ] **Step 1: Add failing integration assertions**

Assert the collapsed input renders `在午夜 0:19` for `19 0 * * *`. Assert the
scheduled-task table renders `在晚上 08:19` for a fixture using `19 20 * * *`.

- [ ] **Step 2: Run the component tests and verify RED**

Run:
`corepack pnpm exec vitest run apps/web/src/components/cronExpressionInput/cron-expression-input.test.tsx apps/web/src/modules/scheduled-tasks/scheduled-tasks-view.test.tsx`

Expected: FAIL with the original `上午`/`下午` descriptions.

- [ ] **Step 3: Replace direct cronstrue calls**

Import `describeCronExpression` in the input, editor, and scheduled-task view.
Remove their direct `cronstrue` and locale imports. Preserve each caller's
existing `try/catch` and fallback text.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

### Task 3: Verify the web package

**Files:**
- Verify only.

- [ ] **Step 1: Run the full web-related test suite**

Run: `corepack pnpm exec vitest run apps/web`

Expected: PASS.

- [ ] **Step 2: Run strict type checking**

Run: `corepack pnpm --filter @hold-rein/web typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Inspect the final diff**

Run: `git diff --check` and confirm no direct `cronstrue.toString` calls remain
outside `cron-description.ts`.
