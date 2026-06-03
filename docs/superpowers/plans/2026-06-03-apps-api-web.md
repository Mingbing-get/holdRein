# Apps API And Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal Express API app and a minimal React + Ant Design web app under `apps`, with tests and workspace wiring.

**Architecture:** The API app will use a small layered structure with `router/v1`, `middleware`, `service`, and a `modules/health` boundary. The web app will use Vite React with a small `config` and `modules/health` structure, and will read the API base URL from environment variables.

**Tech Stack:** TypeScript, Express, React, Vite, Ant Design, Vitest

---

### Task 1: Workspace Test Coverage

**Files:**
- Modify: `vitest.config.ts`
- Modify: `tsconfig.json`

- [ ] **Step 1: Write the failing test**
Add app test paths that do not exist yet by creating app test files first.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test`
Expected: FAIL because app test files or app sources are missing.

- [ ] **Step 3: Write minimal implementation**
Update root test and TypeScript includes to cover `apps/**/*.test.ts`, `apps/**/*.test.tsx`, `apps/**/*.ts`, and `apps/**/*.tsx`.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm test`
Expected: The runner discovers app tests and only fails on missing app implementation.

### Task 2: API Health Behavior

**Files:**
- Create: `apps/api/src/service/health-service.ts`
- Create: `apps/api/src/modules/health/health-service.test.ts`
- Create: `apps/api/src/modules/health/health-router.test.ts`
- Create: `apps/api/src/modules/health/health-router.ts`
- Create: `apps/api/src/router/v1/index.ts`
- Create: `apps/api/src/middleware/not-found-middleware.ts`
- Create: `apps/api/src/middleware/error-middleware.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`

- [ ] **Step 1: Write the failing test**
Add a service test for the health payload and a route test for `GET /api/v1/health`.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test`
Expected: FAIL because the API source files do not exist.

- [ ] **Step 3: Write minimal implementation**
Add the health service, router, middleware, and Express app wiring.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm test`
Expected: The API tests pass.

### Task 3: Web Minimal UI

**Files:**
- Create: `apps/web/src/config/env.ts`
- Create: `apps/web/src/modules/health/health-panel.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/app.test.tsx`

- [ ] **Step 1: Write the failing test**
Add tests for env parsing and minimal rendering.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test`
Expected: FAIL because the web source files do not exist.

- [ ] **Step 3: Write minimal implementation**
Add a minimal Ant Design-based app that renders the configured base URL.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm test`
Expected: The web tests pass.

### Task 4: Package Wiring

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tsconfig.node.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/.env.example`

- [ ] **Step 1: Write the failing test**
Use the existing app tests as the failing signal.

- [ ] **Step 2: Run test to verify it fails**
Run: `pnpm test`
Expected: FAIL or type/module resolution errors because package wiring is incomplete.

- [ ] **Step 3: Write minimal implementation**
Add package manifests, TypeScript config, Vite config, and env example.

- [ ] **Step 4: Run test to verify it passes**
Run: `pnpm test && pnpm typecheck`
Expected: PASS.
