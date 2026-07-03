# Plugin Skill Materialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Materialize inline server and browser plugin skills, including Markdown references, below `AGENT_ROOT_DIR/temp` so model-visible skill paths are readable.

**Architecture:** Plugin APIs expose inline skill content plus optional Markdown references. The API validates and writes each harness's inline skills to an isolated temporary directory, returns ordinary `Skill` objects with absolute `SKILL.md` paths, and removes the directory when that harness settles.

**Tech Stack:** Strict TypeScript, Node.js filesystem APIs, Vitest, pnpm/Vite workspace packages.

---

### Task 1: Extend plugin contribution contracts

**Files:**
- Modify: `packages/plugin-server/src/type.ts`
- Modify: `packages/plugin-web/src/type.ts`
- Modify: `apps/api/src/modules/agents/agent-types.ts`

- [x] Add explicit inline skill and Markdown reference types.
- [x] Propagate references through the browser contribution request without dropping them.
- [x] Add parsing tests for valid and invalid references.

### Task 2: Materialize inline skills safely

**Files:**
- Create: `apps/api/src/modules/agents/runtime/materialized-skills.ts`
- Create: `apps/api/src/modules/agents/runtime/materialized-skills.test.ts`
- Modify: `apps/api/src/config/const.ts`

- [x] Write failing tests for `SKILL.md`, nested Markdown references, unique skill paths, cleanup, and unsafe paths.
- [x] Implement materialization below `AGENT_ROOT_DIR/temp/skills` with strict relative Markdown path validation.
- [x] Return a cleanup callback that recursively removes only the newly-created harness directory.

### Task 3: Integrate with the agent lifecycle

**Files:**
- Modify: `apps/api/src/modules/agents/runtime/skills.ts`
- Modify: `apps/api/src/modules/agents/runtime/index.ts`
- Modify: `apps/api/src/modules/agents/runtime/browser-runtime-contributions.ts`
- Test: `apps/api/src/modules/agents/runtime/browser-runtime-contributions.test.ts`

- [x] Replace in-memory/fake-URI skills with materialized skills before constructing the harness.
- [x] Run cleanup when `harness.prompt()` settles, including errors and interruption.
- [x] Verify continuation harnesses receive fresh readable paths.

### Task 4: Verify

- [x] Run focused Vitest suites for API runtime and web contribution serialization.
- [x] Run package type checks and confirm all edited files remain within 500 lines.
- [x] Run the broader affected-package test suites.
