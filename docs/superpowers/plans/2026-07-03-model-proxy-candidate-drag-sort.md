# Model Proxy Candidate Drag Sort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add handle-only drag sorting to model proxy candidates while preserving form values and deriving submitted priorities from the new order.

**Architecture:** Keep Ant Design `Form.List` as the source of truth and use its `move` operation on native HTML drop. Component state tracks only transient drag source and target indices; no dependency or API change is required.

**Tech Stack:** React 19, strict TypeScript, Ant Design 6, Vitest, Testing Library

---

### Task 1: Specify candidate reordering behavior

**Files:**
- Test: `apps/web/src/modules/model-providers/model-proxy-panel.test.tsx`

- [ ] Add a test that opens an existing proxy with two distinct candidates.
- [ ] Drag the second candidate's handle onto the first candidate card.
- [ ] Assert the provider/model field values visibly swap positions.
- [ ] Submit and assert the request assigns priority 1 to the formerly second candidate.
- [ ] Run `corepack pnpm exec vitest run apps/web/src/modules/model-providers/model-proxy-panel.test.tsx` and confirm the new test fails because no drag handle exists.

### Task 2: Implement handle-only drag sorting

**Files:**
- Modify: `apps/web/src/modules/model-providers/model-proxy-panel.tsx`

- [ ] Add explicit drag state for the source and current target indices.
- [ ] Include Ant Design's drag icon in each candidate title as the sole draggable element.
- [ ] Accept drag-over/drop events on candidate cards and call `Form.List`'s `move(from, to)`.
- [ ] Clear drag state on drop and drag end.
- [ ] Use existing application CSS variables for the drop-target border cue.
- [ ] Run the focused test and confirm it passes.

### Task 3: Add complete-card drag preview and edge auto-scroll

**Files:**
- Modify: `apps/web/src/modules/model-providers/model-proxy-candidate-list.tsx`
- Modify: `apps/web/src/modules/model-providers/model-proxy-panel.tsx`
- Test: `apps/web/src/modules/model-providers/model-proxy-panel.test.tsx`

- [ ] Add failing tests asserting `setDragImage` receives the candidate card.
- [ ] Add failing tests for upward and downward edge scrolling and animation cancellation.
- [ ] Mark the modal form scroll container and locate it from the dragged candidate.
- [ ] Set the full card as the native preview on drag start.
- [ ] Add a document drag-over listener and animation-frame scroll loop using a 48-pixel edge zone.
- [ ] Stop scrolling on drop, drag end, modal close, and unmount.
- [ ] Run the focused test and confirm it passes.

### Task 4: Verify quality gates

**Files:**
- Verify: `apps/web/src/modules/model-providers/model-proxy-panel.tsx`
- Verify: `apps/web/src/modules/model-providers/model-proxy-panel.test.tsx`

- [ ] Run the focused Vitest file.
- [ ] Run `corepack pnpm --filter @hold-rein/web typecheck`.
- [ ] Run ESLint on both modified TypeScript files.
- [ ] Confirm every source file remains at or below 500 lines.
