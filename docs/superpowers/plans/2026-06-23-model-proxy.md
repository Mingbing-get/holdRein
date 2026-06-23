# Model Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement local model proxies that route agent runs to prioritized real models with token-window limits.

**Architecture:** Add proxy persistence beside existing model provider tables, expose versioned CRUD and local provider model endpoints, and integrate runtime resolution through a proxy controller that can switch future harness requests. The frontend adds a proxy management module to the existing model provider settings view.

**Tech Stack:** TypeScript, Express, Drizzle SQLite, Vitest, React, Ant Design.

---

### Task 1: Persistence And Service

**Files:**
- Modify: `apps/api/src/db/schema.ts`
- Modify: `apps/api/src/db/migrate.ts`
- Create: `apps/api/src/modules/model-proxies/model-proxy-repository.ts`
- Create: `apps/api/src/modules/model-proxies/model-proxies-service.ts`
- Create: `apps/api/src/modules/model-proxies/index.ts`
- Test: `apps/api/src/modules/model-proxies/model-proxy-repository.test.ts`
- Test: `apps/api/src/modules/model-proxies/model-proxies-service.test.ts`
- Test: `apps/api/src/db/database.test.ts`

- [ ] Write failing tests for CRUD, migrations, validation, and availability windows.
- [ ] Run targeted API tests and confirm failures for missing proxy tables/service.
- [ ] Implement schema, migrations, repository, validation, and availability evaluation.
- [ ] Re-run targeted tests and keep files under 500 lines.

### Task 2: API And Provider List Integration

**Files:**
- Modify: `apps/api/src/router/v1/index.ts`
- Modify: `apps/api/src/modules/model-providers/model-providers-service.ts`
- Modify: `apps/api/src/modules/model-providers/model-providers-router.ts`
- Create: `apps/api/src/modules/model-proxies/model-proxies-router.ts`
- Test: `apps/api/src/modules/model-proxies/model-proxies-router.test.ts`
- Test: `apps/api/src/modules/model-providers/model-providers-router.test.ts`

- [ ] Write failing route tests for CRUD and `local` provider/model listing.
- [ ] Run targeted tests and confirm route failures.
- [ ] Implement router wiring and provider list integration.
- [ ] Re-run route tests.

### Task 3: Runtime Proxy Resolution

**Files:**
- Modify: `apps/api/src/modules/agents/runtime/type.ts`
- Modify: `apps/api/src/modules/agents/runtime/index.ts`
- Create: `apps/api/src/modules/model-proxies/model-proxy-runtime.ts`
- Test: `apps/api/src/modules/agents/runtime/index.test.ts`
- Test: `apps/api/src/modules/model-proxies/model-proxy-runtime.test.ts`

- [ ] Write failing tests for initial selection, fallback after `message_end`, real-model token recording, and current-model API key lookup.
- [ ] Run targeted tests and confirm failures.
- [ ] Implement runtime controller and inject proxy service into default agent service.
- [ ] Re-run targeted runtime tests.

### Task 4: Frontend Proxy Module

**Files:**
- Modify: `apps/web/src/modules/model-providers/model-provider-types.ts`
- Modify: `apps/web/src/modules/model-providers/model-provider-api.ts`
- Modify: `apps/web/src/modules/model-providers/model-providers-view.tsx`
- Create: `apps/web/src/modules/model-providers/model-proxy-panel.tsx`
- Test: `apps/web/src/modules/model-providers/model-providers-view.test.tsx`

- [ ] Query Ant Design APIs for controls used by the editor.
- [ ] Write failing tests for editor validation, candidate serialization, and refresh.
- [ ] Implement the embedded proxy panel using existing theme variables and Ant Design controls.
- [ ] Re-run targeted frontend tests.

### Task 5: Final Verification

- [ ] Run API tests for changed backend modules.
- [ ] Run web tests for changed frontend modules.
- [ ] Run package type/build checks if available.
- [ ] Review `git diff` for accidental unrelated changes.
