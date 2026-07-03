# Subagent Depth Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist subagent depth and stop exposing `call_subagent` at depth 3 while allowing plugin-driven continuation subagents.

**Architecture:** Carry an explicit numeric depth from harness startup through ordinary and continuation child creation, persist it on every subagent row, and restore it from storage. Keep the depth policy in the focused subagent tool module so the nearly 500-line runtime coordinator remains within the repository limit.

**Tech Stack:** strict TypeScript, Drizzle SQLite, Vitest, ESLint, Corepack pnpm

---

### Task 1: Persist subagent depth

**Files:**
- Modify: `apps/api/src/db/schema.ts`
- Modify: `apps/api/src/db/migrate.ts`
- Test: `apps/api/src/db/database.test.ts`

- [ ] **Step 1: Write failing database tests**

Add assertions that a newly created `subagents` row can store an explicit `depth`, and that a legacy table gains `depth INTEGER NOT NULL DEFAULT 1` after migration.

```ts
expect(row).toMatchObject({ depth: 3 });
expect(legacyRow).toMatchObject({ depth: 1 });
```

- [ ] **Step 2: Verify the focused database tests fail**

Run: `corepack pnpm --filter @hold-rein/api exec vitest run src/db/database.test.ts`

Expected: FAIL because `subagents.depth` does not exist.

- [ ] **Step 3: Add the schema field and idempotent migration**

Add the Drizzle field and both fresh/upgrade SQL definitions:

```ts
depth: integer("depth").notNull().default(1),
```

```sql
depth INTEGER NOT NULL DEFAULT 1
```

Call `addColumnIfMissing` for the upgrade statement before subagent status relaxation.

- [ ] **Step 4: Verify database tests pass**

Run: `corepack pnpm --filter @hold-rein/api exec vitest run src/db/database.test.ts`

Expected: PASS.

### Task 2: Enforce the model-visible tool depth boundary

**Files:**
- Modify: `apps/api/src/modules/agents/runtime/subagent-tools.ts`
- Test: `apps/api/src/modules/agents/runtime/subagents.test.ts`

- [ ] **Step 1: Write a failing tool-selection test**

Start harnesses at depths `0`, `2`, and `3`, then inspect their configured tool names:

```ts
expect(depthTwoTools).toContain("call_subagent");
expect(depthThreeTools).not.toContain("call_subagent");
```

- [ ] **Step 2: Verify the focused test fails**

Run: `corepack pnpm --filter @hold-rein/api exec vitest run src/modules/agents/runtime/subagents.test.ts`

Expected: FAIL because depth-3 harnesses still expose `call_subagent`.

- [ ] **Step 3: Add the policy to tool assembly**

Pass `depth` into `createRuntimeSubagentTools` and conditionally append only the call tool:

```ts
...(input.depth < MAX_MODEL_SUBAGENT_DEPTH
  ? [createCallSubagentTool({ startSubagent: request => startSubagent(input, request) })]
  : []),
```

Plugin/browser tools and the conditional revoke tool remain unchanged.

- [ ] **Step 4: Verify the focused test passes**

Run the same Vitest command and expect PASS.

### Task 3: Propagate and restore depth

**Files:**
- Modify: `apps/api/src/modules/agents/subagent/index.ts`
- Modify: `apps/api/src/modules/agents/runtime/type.ts`
- Modify: `apps/api/src/modules/agents/runtime/index.ts`
- Modify: `apps/api/src/modules/agents/runtime/subagent-tools.ts`
- Modify: `apps/api/src/modules/agents/runtime/continuation-subagent.ts`
- Test: `apps/api/src/modules/agents/runtime/subagents.test.ts`
- Test: `apps/api/src/modules/agents/runtime/continuation-subagent.test.ts`

- [ ] **Step 1: Write failing propagation and restoration tests**

Assert ordinary and continuation children persist `parentDepth + 1`; assert a resumed row with `depth: 3` starts a harness without `call_subagent`; assert a depth-3 parent's `onAgentEnd` still creates a depth-4 child.

```ts
expect(repository.findByAgentId(childId)?.depth).toBe(parentDepth + 1);
expect(depthFourHarness.activeToolNames).not.toContain("call_subagent");
```

- [ ] **Step 2: Verify the runtime tests fail**

Run both runtime test files with Vitest. Expected: FAIL because runtime types and rows do not carry depth.

- [ ] **Step 3: Add explicit depth to runtime types and child creation**

Use required depth on runtime subagent state and an optional startup value defaulting only at the main entry:

```ts
export interface SubagentRun<ParentSession> {
  depth: number;
  // existing fields
}

export interface StartHarnessOptions {
  depth?: number;
  // existing fields
}
```

Inside harness creation resolve `const depth = harnessOptions.depth ?? 0`. Pass `depth + 1` into both child creators; persist it, store it in `SubagentRun`, and pass it to `startHarness`.

- [ ] **Step 4: Restore persisted depth on revoke/resume**

When rebuilding a completed child, set both the in-memory run and startup options from the row:

```ts
depth: subagentRow.depth,
```

Same-harness continuations pass the current subagent's depth, or `0` for the main harness.

- [ ] **Step 5: Verify focused runtime tests pass**

Run the runtime test files and expect PASS.

### Task 4: Full verification

**Files:**
- Verify all modified files remain at or below 500 lines.

- [ ] **Step 1: Run API tests**

Run: `corepack pnpm --filter @hold-rein/api test`

Expected: PASS with no regressions.

- [ ] **Step 2: Run API typecheck and lint scripts available in package.json**

Run the package's declared typecheck and lint commands through `corepack pnpm`. Expected: exit code 0.

- [ ] **Step 3: Check formatting, diff, and file sizes**

Run `git diff --check` and `wc -l` on modified TypeScript files. Expected: no whitespace errors and no file over 500 lines.
