# Cron Expression Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and integrate a reusable visual five-field cron expression input matching the approved design.

**Architecture:** Keep cron parsing and serialization in a pure model module, render field selection and draft editing in focused React components, and expose a controlled Ant Design-compatible input. The scheduled-task form only consumes the public component API.

**Tech Stack:** React 19, strict TypeScript, Ant Design 6, cronstrue, CSS variables, Vitest, Testing Library.

---

### Task 1: Pure cron expression model

**Files:**
- Create: `apps/web/src/components/cronExpressionInput/cron-expression-types.ts`
- Create: `apps/web/src/components/cronExpressionInput/cron-expression.ts`
- Test: `apps/web/src/components/cronExpressionInput/cron-expression.test.ts`

- [ ] Write failing tests for five-field parsing, range/step expansion, normalization, inference, and typed errors.
- [ ] Run the focused test and confirm it fails because the model is missing.
- [ ] Implement strict parsing and serialization with explicit public types.
- [ ] Run the focused test and confirm it passes.

### Task 2: Accessible editor controls

**Files:**
- Create: `apps/web/src/components/cronExpressionInput/cron-field-selector.tsx`
- Create: `apps/web/src/components/cronExpressionInput/cron-expression-editor.tsx`
- Create: `apps/web/src/components/cronExpressionInput/cron-expression-input.css`
- Test: `apps/web/src/components/cronExpressionInput/cron-expression-input.test.tsx`

- [ ] Write failing interaction tests for frequency visibility, draft isolation, selection, cancel, and confirm.
- [ ] Run the focused component test and confirm the expected failure.
- [ ] Implement field grids and editor draft behavior.
- [ ] Run the focused component test and confirm it passes.

### Task 3: Controlled input boundary

**Files:**
- Create: `apps/web/src/components/cronExpressionInput/cron-expression-input.tsx`
- Create: `apps/web/src/components/cronExpressionInput/index.ts`
- Test: `apps/web/src/components/cronExpressionInput/cron-expression-input.test.tsx`

- [ ] Add failing tests for translation, placeholder, invalid values, controlled updates, disabled/status/blur behavior, dismissal, and Escape.
- [ ] Implement the read-only Ant Design Input and controlled Popover.
- [ ] Run the focused component tests and confirm they pass.

### Task 4: Scheduled-task form integration

**Files:**
- Modify: `apps/web/src/modules/scheduled-tasks/scheduled-task-edit-modal.tsx`
- Modify: `apps/web/src/modules/scheduled-tasks/scheduled-tasks-view.test.tsx`

- [ ] Update the form test to select a schedule through the visual editor.
- [ ] Confirm the integration test fails while the raw Input remains.
- [ ] Replace the raw cron Input with `CronExpressionInput`.
- [ ] Run scheduled-task tests and confirm the serialized value is submitted.

### Task 5: Full verification

- [ ] Run focused cron tests.
- [ ] Run the complete web test suite.
- [ ] Run `corepack pnpm --filter @hold-rein/web typecheck`.
- [ ] Run `corepack pnpm lint`.
- [ ] Run `corepack pnpm --filter @hold-rein/web build`.
- [ ] Confirm every changed source file is at most 500 lines and inspect the final diff.
