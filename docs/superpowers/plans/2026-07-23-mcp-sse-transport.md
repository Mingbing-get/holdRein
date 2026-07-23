# MCP SSE Transport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a legacy SSE transport option to the MCP plugin without changing Streamable HTTP or stdio behavior.

**Architecture:** Treat `sse` as a remote transport that shares URL/header configuration with HTTP. The client factory chooses the MCP SDK's `SSEClientTransport` for that option, while the existing HTTP branch remains Streamable HTTP.

**Tech Stack:** TypeScript, MCP SDK 1.25, React, Ant Design, Vitest.

---

### Task 1: Accept SSE configuration

**Files:**
- Modify: `packages/plugins/mcp/src/server/types.ts`
- Modify: `packages/plugins/mcp/src/server/routes.ts`
- Modify: `packages/plugins/mcp/src/server/service.ts`
- Test: `packages/plugins/mcp/src/server/routes.test.ts`
- Test: `packages/plugins/mcp/src/server/service.test.ts`

- [ ] Add failing tests for an `sse` configuration and URL validation.
- [ ] Run the focused server test file and verify the rejection is caused by the missing transport value.
- [ ] Add `sse` to the transport union and require a URL for SSE configurations.
- [ ] Re-run focused server tests.

### Task 2: Create the SSE transport

**Files:**
- Modify: `packages/plugins/mcp/src/server/mcp-client.ts`
- Test: `packages/plugins/mcp/src/server/mcp-client.test.ts`

- [ ] Add a failing factory test that expects SSE configs to create the SDK's `SSEClientTransport` with URL and headers.
- [ ] Run the focused test and verify it fails before implementation.
- [ ] Select `SSEClientTransport` for `sse`, preserving stdio and Streamable HTTP branches.
- [ ] Re-run the focused test.

### Task 3: Expose SSE in settings

**Files:**
- Modify: `packages/plugins/mcp/src/web/mcp-settings-types.ts`
- Modify: `packages/plugins/mcp/src/web/mcp-settings-view.tsx`
- Test: `packages/plugins/mcp/src/web/mcp-settings-view.test.tsx`

- [ ] Add a failing UI test for selecting SSE and entering a URL.
- [ ] Run the focused UI test and verify it fails because SSE is unavailable.
- [ ] Add the transport type and Segmented option; retain URL/header fields for SSE.
- [ ] Re-run focused UI tests.

### Task 4: Verify the plugin

**Files:**
- Verify: `packages/plugins/mcp/src/server/*.test.ts`
- Verify: `packages/plugins/mcp/src/web/*.test.tsx`

- [ ] Run MCP plugin tests and typecheck.
- [ ] Review the diff to ensure the unrelated working-tree changes remain untouched.
