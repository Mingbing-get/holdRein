# MCP Configuration Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an MCP-plugin skill that teaches agents the supported configuration transports and configuration-file location.

**Architecture:** Add a packaged skill beneath the MCP server source tree and register its directory from the server plugin. Reuse the established Vite close-bundle copy pattern so the published package contains the skill at `dist/skills`.

**Tech Stack:** TypeScript, Vite, Vitest, Markdown.

---

### Task 1: Register and package the MCP skill

**Files:**
- Create: `packages/plugins/mcp/src/server.test.ts`
- Create: `packages/plugins/mcp/src/server/skills/mcp-configuration/SKILL.md`
- Modify: `packages/plugins/mcp/src/server.ts`
- Modify: `packages/plugins/mcp/vite.config.ts`

- [ ] **Step 1: Write failing registration and copy tests**

  Verify the plugin contributes `mcp-configuration` through `skillDirs`, and the Vite copy plugin places `SKILL.md` in `dist/skills/mcp-configuration`.

- [ ] **Step 2: Run the focused test**

  Run: `corepack pnpm exec vitest run packages/plugins/mcp/src/server.test.ts`

  Expected: FAIL because no skill directory or copy plugin exists.

- [ ] **Step 3: Add the skill and minimal runtime/build integration**

  Register a source-or-distribution skill root, copy source skills to `dist/skills` on Vite close-bundle, and document only `stdio`, `http`, and `sse`, plus the exact persisted-config path.

- [ ] **Step 4: Re-run the focused test**

  Run: `corepack pnpm exec vitest run packages/plugins/mcp/src/server.test.ts`

  Expected: PASS.

### Task 2: Verify the plugin package

**Files:**
- Verify: `packages/plugins/mcp/src/server.test.ts`
- Verify: `packages/plugins/mcp/dist/skills/mcp-configuration/SKILL.md`

- [ ] **Step 1: Run MCP tests and typecheck**

  Run: `corepack pnpm exec vitest run packages/plugins/mcp/src/server.test.ts packages/plugins/mcp/src/server/*.test.ts packages/plugins/mcp/src/web/*.test.tsx && corepack pnpm --filter @hold-rein/plugin-mcp typecheck`

- [ ] **Step 2: Build the plugin and inspect packaged skill**

  Run: `corepack pnpm --filter @hold-rein/plugin-mcp build && test -f packages/plugins/mcp/dist/skills/mcp-configuration/SKILL.md`

  Expected: build succeeds and the skill exists in `dist`.
