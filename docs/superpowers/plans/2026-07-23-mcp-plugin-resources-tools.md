# MCP Plugin Resources Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an independent MCP plugin with JSON-file configuration, encrypted env persistence, MCP tool contribution, and MCP resource access through `mcp_list_resources` and `mcp_read_resource`.

**Architecture:** Keep all persistence and runtime behavior inside `packages/plugins/mcp`. Store config in `~/.hold-rein/plugin-data/mcp/config.json`, encrypt env values with the same `PROVIDER_API_KEY_ENCRYPTION_KEY`, expose config through plugin private routes, and expose MCP tools/resources as normal `ServerPlugin.PluginTool` entries.

**Tech Stack:** TypeScript, Express plugin routes, Node `fs/path/os/crypto`, `@modelcontextprotocol/sdk`, React, Ant Design, Vitest.

---

## File Map

- `packages/plugins/mcp/src/server/crypto.ts`: encrypt/decrypt secret helpers.
- `packages/plugins/mcp/src/server/types.ts`: config DTOs, file schema, MCP result types.
- `packages/plugins/mcp/src/server/storage.ts`: JSON file persistence under home `.hold-rein/plugin-data/mcp`.
- `packages/plugins/mcp/src/server/service.ts`: validation, encryption, summaries, runtime configs.
- `packages/plugins/mcp/src/server/routes.ts`: `GET/PUT/DELETE /servers`.
- `packages/plugins/mcp/src/server/mcp-client.ts`: MCP SDK adapter.
- `packages/plugins/mcp/src/server/tools.ts`: MCP tool/resource wrappers.
- `packages/plugins/mcp/src/server.ts`: route and contribution wiring.
- `packages/plugins/mcp/src/web.ts`: settings contribution.
- `packages/plugins/mcp/src/web/*`: settings API, types, view, tests.
- `packages/plugins/mcp/package.json`: add direct MCP SDK dependency if missing.

---

### Task 1: Build Plugin JSON Storage

**Files:**
- Create: `packages/plugins/mcp/src/server/types.ts`
- Create: `packages/plugins/mcp/src/server/storage.ts`
- Test: `packages/plugins/mcp/src/server/storage.test.ts`

- [ ] Write failing tests for default storage path, creating parent directories, reading missing config as empty, saving configs atomically enough for local use, and rejecting malformed JSON with a clear error.
- [ ] Run `corepack pnpm exec vitest run packages/plugins/mcp/src/server/storage.test.ts`; expect failure.
- [ ] Define file data types in `types.ts`: `McpTransport`, `PersistedMcpServerConfig`, and `PersistedMcpConfigFile`.
- [ ] Implement `getDefaultMcpConfigPath()` returning `join(homedir(), ".hold-rein", "plugin-data", "mcp", "config.json")`.
- [ ] Implement `createMcpConfigStorage({ configPath? })` with `read()` and `write(configFile)`.
- [ ] Use Node built-ins directly inside the storage module; do not inject `fs`, `path`, or `process`.
- [ ] Re-run storage tests; expect pass.
- [ ] Commit: `feat(mcp): add plugin json config storage`.

---

### Task 2: Build Config Service With Encrypted Env

**Files:**
- Create: `packages/plugins/mcp/src/server/crypto.ts`
- Modify: `packages/plugins/mcp/src/server/types.ts`
- Create: `packages/plugins/mcp/src/server/service.ts`
- Test: `packages/plugins/mcp/src/server/service.test.ts`

- [ ] Write failing tests for encrypted env persistence, masked summaries, preserving existing env keys when values are `null`, disabled filtering, delete behavior, and validation failures.
- [ ] Run `corepack pnpm exec vitest run packages/plugins/mcp/src/server/service.test.ts`; expect failure.
- [ ] Implement `encryptSecret` and `decryptSecret` with AES-256-GCM and 32-byte base64 key validation.
- [ ] Add DTOs: `McpServerConfigInput`, `McpServerConfigSummary`, and `McpServerRuntimeConfig`.
- [ ] Implement `McpServerConfigService` using `createMcpConfigStorage`.
- [ ] Service methods: `saveServerConfig`, `listServerConfigs`, `listEnabledServerConfigs`, and `deleteServerConfig`.
- [ ] Validate: non-empty name; `stdio` requires command; `http` requires URL; args/headers/env default empty.
- [ ] Ensure decrypted env values appear only in `listEnabledServerConfigs`, never in route summaries or UI summaries.
- [ ] Re-run service tests; expect pass.
- [ ] Commit: `feat(mcp): persist encrypted mcp server configs`.

---

### Task 3: Add Plugin Config Routes

**Files:**
- Create: `packages/plugins/mcp/src/server/routes.ts`
- Test: `packages/plugins/mcp/src/server/routes.test.ts`
- Modify: `packages/plugins/mcp/src/server.ts`

- [ ] Write failing route tests for `GET /servers`, `PUT /servers/:id`, `DELETE /servers/:id`, invalid bodies, and no plaintext env leakage.
- [ ] Run `corepack pnpm exec vitest run packages/plugins/mcp/src/server/routes.test.ts`; expect failure.
- [ ] Implement routes with `ServerPlugin.RouteContext` helpers and plugin-local service.
- [ ] Route shape: `GET /servers`, `PUT /servers/:id`, `DELETE /servers/:id`.
- [ ] Validate unknown request bodies before service calls.
- [ ] Wire `registerRoutes: createRouter` in `packages/plugins/mcp/src/server.ts`.
- [ ] Re-run route tests; expect pass.
- [ ] Commit: `feat(mcp): expose mcp config routes`.

---

### Task 4: Add MCP SDK Adapter

**Files:**
- Create: `packages/plugins/mcp/src/server/mcp-client.ts`
- Test: `packages/plugins/mcp/src/server/mcp-client.test.ts`
- Modify: `packages/plugins/mcp/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] Add `@modelcontextprotocol/sdk` as a direct dependency if `packages/plugins/mcp/package.json` does not already declare it.
- [ ] Run `corepack pnpm install`; expect lockfile consistency.
- [ ] Write failing tests using an injected client factory, not real subprocesses.
- [ ] Cover `listTools`, `callTool`, `listResources`, `listResourceTemplates`, and `readResource`.
- [ ] Run `corepack pnpm exec vitest run packages/plugins/mcp/src/server/mcp-client.test.ts`; expect failure.
- [ ] Implement a `McpClientManager` that supports stdio command/args/env and HTTP URL/headers transports.
- [ ] Close clients after each operation unless a tested cache is added.
- [ ] Re-run adapter tests; expect pass.
- [ ] Commit: `feat(mcp): add mcp sdk client adapter`.

---

### Task 5: Contribute MCP Tools And Resource Tools

**Files:**
- Create: `packages/plugins/mcp/src/server/tools.ts`
- Test: `packages/plugins/mcp/src/server/tools.test.ts`
- Modify: `packages/plugins/mcp/src/server.ts`

- [ ] Write failing tests for enabled MCP tool contribution, disabled server exclusion, safe tool-name normalization, `mcp_list_resources`, `mcp_read_resource`, and partial failure isolation.
- [ ] Run `corepack pnpm exec vitest run packages/plugins/mcp/src/server/tools.test.ts`; expect failure.
- [ ] Wrap MCP tools as `mcp_<serverId>_<toolName>` `ServerPlugin.PluginTool` entries.
- [ ] Use MCP input schemas as `parameters`; fall back to an empty object schema when missing.
- [ ] Implement `mcp_list_resources({ serverId?: string })` returning JSON text with per-server `resources` and `resourceTemplates`.
- [ ] Implement `mcp_read_resource({ serverId, uri })` returning MCP text/image content when possible and pretty JSON otherwise.
- [ ] Ensure one failing MCP server does not prevent other servers from contributing tools/resources.
- [ ] Wire `contributionResolver` in `server.ts` to return wrapped MCP tools and the two resource tools.
- [ ] Re-run tool tests; expect pass.
- [ ] Commit: `feat(mcp): expose mcp tools and resources`.

---

### Task 6: Add Web MCP Settings

**Files:**
- Modify: `packages/plugins/mcp/src/web.ts`
- Create: `packages/plugins/mcp/src/web/mcp-settings-api.ts`
- Create: `packages/plugins/mcp/src/web/mcp-settings-types.ts`
- Create: `packages/plugins/mcp/src/web/mcp-settings-view.tsx`
- Test: `packages/plugins/mcp/src/web/mcp-settings-view.test.tsx`

- [ ] Write failing tests for settings contribution, loading servers, saving, deleting, transport switching, and secret masking.
- [ ] Run `corepack pnpm exec vitest run packages/plugins/mcp/src/web/mcp-settings-view.test.tsx`; expect failure.
- [ ] Implement API wrappers using plugin runtime `request` for `/api/v1/plugins/__mcp__plugin/servers`.
- [ ] Build a compact Ant Design settings UI with server list, enabled switch, transport selector, stdio command/args/env fields, HTTP URL/header fields, save, and delete.
- [ ] Use `--app-*` CSS variables for custom styling; do not hard-code colors.
- [ ] Split helpers/components if `mcp-settings-view.tsx` nears 500 lines.
- [ ] Update `web.ts` to contribute a `MCP 配置` settings item.
- [ ] Re-run web tests; expect pass.
- [ ] Commit: `feat(mcp): add mcp settings view`.

---

### Task 7: Verify Integration

**Files:**
- Modify only files needed to fix verification failures.

- [ ] Run `corepack pnpm --filter @hold-rein/plugin-mcp typecheck`; expect pass.
- [ ] Run `corepack pnpm --filter @hold-rein/plugin-mcp build`; expect pass.
- [ ] Run focused tests:

```bash
corepack pnpm exec vitest run packages/plugins/mcp/src/server/storage.test.ts packages/plugins/mcp/src/server/service.test.ts packages/plugins/mcp/src/server/routes.test.ts packages/plugins/mcp/src/server/mcp-client.test.ts packages/plugins/mcp/src/server/tools.test.ts packages/plugins/mcp/src/web/mcp-settings-view.test.tsx
```

- [ ] Run `corepack pnpm test` if time allows; document unrelated failures with test names.
- [ ] Run `wc -l packages/plugins/mcp/src/server/*.ts packages/plugins/mcp/src/web/*.ts packages/plugins/mcp/src/web/*.tsx`; every file must be at or below 500 lines.
- [ ] Run `git status --short` and confirm only intended plugin files changed.
- [ ] Final commit: `feat(mcp): support mcp configuration and resources`.

---

## Implementation Notes

- Do not modify `apps/api/src/db/*`; MCP config is plugin-owned JSON data.
- The config file lives at `~/.hold-rein/plugin-data/mcp/config.json`.
- `mcp_list_resources` is the model-visible discovery path for both MCP `resources` and `resourceTemplates`.
- `mcp_read_resource` is the content retrieval path. It must accept URIs returned from resource listings and URIs the model constructs from templates.
- Do not add `resources` or `resourceTemplates` to `ServerPlugin.Contribution` in this implementation.
- Do not leak decrypted env values through routes, logs, tool results, snapshots, or UI.
- Start with short-lived MCP clients. Add pooling only after correctness is proven and performance requires it.
