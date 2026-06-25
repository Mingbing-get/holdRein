# Browser Runtime Contributions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add request-scoped browser tool schemas, inline skills, and system prompts to agent start and continue runs.

**Architecture:** Start and continue requests carry validated runtime contributions through the web API, agent service, and runtime. The runtime wraps browser tool schemas as proxy tools that emit NDJSON events and wait for browser-submitted results. The web task provider listens for those events, invokes local browser executors by tool name, and posts the result back to the API.

**Tech Stack:** Strict TypeScript, Express, React, Vitest, React Testing Library, existing `AgentHarness`, existing NDJSON agent event stream.

---

### Task 1: API Request Types And Validation

**Files:**
- Modify: `apps/api/src/modules/agents/agent-types.ts`
- Create: `apps/api/src/modules/agents/runtime/browser-runtime-contributions.ts`
- Modify: `apps/api/src/modules/agents/router/index.ts`
- Test: `apps/api/src/modules/agents/router/index.test.ts`

- [ ] **Step 1: Write failing router tests**

Add start and continue tests that send:

```ts
runtimeContributions: {
  tools: [{ inputSchema: { type: "object" }, name: "read_browser_selection" }],
  skills: [{ content: "# Browser Context", name: "browser-context" }],
  systemPrompts: ["Prefer browser tools for live page context."]
}
```

Assert the fake service receives `runtimeContributions` unchanged in `startAgent` and `continueTask`.

- [ ] **Step 2: Verify tests fail**

Run: `pnpm --filter @hold-rein/api exec vitest run src/modules/agents/router/index.test.ts`

Expected: FAIL because `parseStartAgentBody` and `parseContinueTaskBody` strip the new field.

- [ ] **Step 3: Add public API types**

In `apps/api/src/modules/agents/agent-types.ts`, add:

```ts
export interface BrowserRuntimeToolSchema {
  description?: string;
  inputSchema: unknown;
  name: string;
}

export interface BrowserRuntimeSkill {
  content: string;
  description?: string;
  name: string;
}

export interface BrowserRuntimeContributions {
  skills?: BrowserRuntimeSkill[];
  systemPrompts?: string[];
  tools?: BrowserRuntimeToolSchema[];
}

export interface BrowserToolResultInput {
  agentId: string;
  content: string | StoredTextContent[];
  isError?: boolean;
  toolCallId: string;
}
```

Add `runtimeContributions?: BrowserRuntimeContributions` to `StartAgentInput` and `RunAgentInput`.

- [ ] **Step 4: Add contribution parser**

Create `apps/api/src/modules/agents/runtime/browser-runtime-contributions.ts` with exported functions:

```ts
export function parseBrowserRuntimeContributions(
  value: unknown
): BrowserRuntimeContributions | undefined | null;

export function toRuntimeSkills(
  skills: readonly BrowserRuntimeSkill[] | undefined
): Skill[];
```

Validation rules:

- `runtimeContributions` must be an object when present.
- `tools`, `skills`, and `systemPrompts` must be arrays when present.
- Max 16 tools, 16 skills, and 16 prompts.
- Names must match `/^[a-zA-Z_][a-zA-Z0-9_-]*$/` and be at most 80 chars.
- Descriptions max 1000 chars.
- Skill content and prompt text max 20000 chars.
- Duplicate tool names are invalid.
- Tool `inputSchema` must be present and is preserved as `unknown`.
- Empty strings are invalid after trimming.

Use direct TypeScript guards instead of ad hoc JSON string parsing.

- [ ] **Step 5: Parse request bodies**

In `apps/api/src/modules/agents/router/index.ts`, add `runtimeContributions?: unknown` to `StartAgentBody` and `ContinueTaskBody`. Import `parseBrowserRuntimeContributions`, call it from both body parsers, return `null` when it returns `null`, and include the parsed value in all valid start/continue return objects.

Update bad-request text to mention `runtimeContributions`.

- [ ] **Step 6: Verify tests pass**

Run: `pnpm --filter @hold-rein/api exec vitest run src/modules/agents/router/index.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

Commit the Task 1 files with message `feat(api): accept browser runtime contributions`.

---

### Task 2: Service Forwarding And Result Endpoint

**Files:**
- Modify: `apps/api/src/modules/agents/service/index.ts`
- Modify: `apps/api/src/modules/agents/runtime/type.ts`
- Modify: `apps/api/src/modules/agents/router/index.ts`
- Test: `apps/api/src/modules/agents/service/index.test.ts`
- Test: `apps/api/src/modules/agents/router/index.test.ts`

- [ ] **Step 1: Write failing service forwarding tests**

Add start and continue service tests with:

```ts
runtimeContributions: {
  systemPrompts: ["Request scoped instruction"],
  tools: [{ inputSchema: { type: "object" }, name: "read_browser_selection" }]
}
```

Assert `runtime.start` receives the value unchanged in `runtimeInput`.

- [ ] **Step 2: Write failing result endpoint test**

Add a router test for:

`POST /agents/agent-1/browser-tools/tool-call-1/result`

Body:

```ts
{ content: "Browser result", isError: false }
```

Assert fake service `submitBrowserToolResult` receives `agentId`, `toolCallId`, `content`, and `isError`.

- [ ] **Step 3: Verify tests fail**

Run:

```bash
pnpm --filter @hold-rein/api exec vitest run src/modules/agents/service/index.test.ts src/modules/agents/router/index.test.ts
```

Expected: FAIL because forwarding and result submission do not exist.

- [ ] **Step 4: Extend interfaces**

In `apps/api/src/modules/agents/runtime/type.ts`, add:

```ts
submitBrowserToolResult: (input: BrowserToolResultInput) => Promise<boolean>;
```

In `apps/api/src/modules/agents/service/index.ts`, add:

```ts
submitBrowserToolResult: (
  input: BrowserToolResultInput
) => Promise<BrowserToolResultInput | null>;
```

- [ ] **Step 5: Forward contributions**

In service `startAgent` and `continueTask`, include `input.runtimeContributions` in `runtimeInput` when present.

- [ ] **Step 6: Add service result submission**

Implement:

```ts
submitBrowserToolResult: async (input) => {
  const accepted = await options.runtime.submitBrowserToolResult(input);
  return accepted ? input : null;
}
```

- [ ] **Step 7: Add result endpoint**

In `apps/api/src/modules/agents/router/index.ts`, add `BrowserToolResultBody` and route:

`POST /agents/:agentId/browser-tools/:toolCallId/result`

Validation:

- `content` is either a string up to 100000 chars or an array of up to 64 `{ type: "text"; text: string }` items.
- `isError` is optional boolean.
- Invalid body returns bad request.
- Unknown result submission returns not found.

If route helpers push `index.ts` over 500 lines, create `apps/api/src/modules/agents/router/browser-tool-result.ts` exporting `parseBrowserToolResultBody`.

- [ ] **Step 8: Verify tests pass**

Run:

```bash
pnpm --filter @hold-rein/api exec vitest run src/modules/agents/service/index.test.ts src/modules/agents/router/index.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

Commit the Task 2 files with message `feat(api): add browser tool result endpoint`.

---

### Task 3: Runtime Browser Tool Proxy

**Files:**
- Create: `apps/api/src/modules/agents/runtime/browser-tool-call-store.ts`
- Modify: `apps/api/src/modules/agents/runtime/index.ts`
- Modify: `apps/api/src/modules/agents/runtime/type.ts`
- Test: `apps/api/src/modules/agents/runtime/index.test.ts`
- Test: `apps/api/src/modules/agents/runtime/agent-instructions.test.ts`

- [ ] **Step 1: Write failing browser tool runtime tests**

In `runtime/index.test.ts`, test that a run with `runtimeContributions.tools` creates a harness tool named `read_browser_selection`. Execute it with `tool-call-1` and `{ scope: "selection" }`, assert `browser_tool_call_requested` is emitted, submit result through `runtime.submitBrowserToolResult`, and assert the tool execution resolves to text `Selected text` with `isError: false`.

Add a second test that `runtime.interrupt(agentId)` resolves pending browser calls with an error result and removes them.

- [ ] **Step 2: Write failing skill/prompt merge test**

In `runtime/agent-instructions.test.ts`, start with:

```ts
runtimeContributions: {
  skills: [{ content: "# Browser Skill", name: "browser-skill" }],
  systemPrompts: ["Browser system prompt."]
}
```

Assert harness `resources.skills` contains `browser-skill` and generated system prompt contains `Browser system prompt.`.

- [ ] **Step 3: Verify tests fail**

Run:

```bash
pnpm --filter @hold-rein/api exec vitest run src/modules/agents/runtime/index.test.ts src/modules/agents/runtime/agent-instructions.test.ts
```

Expected: FAIL because proxy tools and pending result store do not exist.

- [ ] **Step 4: Implement pending-call store**

Create `apps/api/src/modules/agents/runtime/browser-tool-call-store.ts` exporting:

```ts
export interface BrowserToolCallRequest {
  agentId: string;
  arguments: Record<string, unknown>;
  toolCallId: string;
  toolName: string;
}

export interface BrowserToolCallStore {
  clearAgent: (agentId: string) => void;
  createCall: (request: BrowserToolCallRequest) => Promise<ToolCallResult>;
  submitResult: (input: BrowserToolResultInput) => boolean;
}

export function createBrowserToolCallStore(timeoutMs = 60000): BrowserToolCallStore;
```

Behavior:

- Key calls by `${agentId}\0${toolCallId}`.
- `createCall` returns duplicate-call error result when key already exists.
- Timeout resolves `{ isError: true, content: [{ type: "text", text: "Browser tool call timed out." }] }`.
- `clearAgent` resolves each pending call for that agent with interrupted error text.
- `submitResult` returns `false` for unknown calls and resolves known calls exactly once.

- [ ] **Step 5: Wire store into runtime**

In `runtime/type.ts`, add `browserToolTimeoutMs?: number` to `CreateAgentRuntimeOptions`.

In `runtime/index.ts`, create the store next to existing runtime maps, implement `submitBrowserToolResult`, and call `browserToolCalls.clearAgent(agentId)` from `interrupt`.

- [ ] **Step 6: Convert schemas to proxy tools**

In `createHarness`, map `input.runtimeContributions?.tools` into `ServerPlugin.PluginTool[]` with:

- `name` from schema.
- `description` from schema.
- `parameters` from `inputSchema`.
- `execute(toolCallId, toolInput)` that emits `browser_tool_call_requested` and returns `browserToolCalls.createCall(...)`.

Merge browser proxy tools after plugin contribution tools when calling `createRuntimeSubagentTools`.

- [ ] **Step 7: Merge inline skills and prompts**

Merge `toRuntimeSkills(input.runtimeContributions?.skills)` after plugin skills. Add `...(input.runtimeContributions?.systemPrompts || [])` after plugin system prompts in the harness system prompt array.

- [ ] **Step 8: Verify tests pass**

Run:

```bash
pnpm --filter @hold-rein/api exec vitest run src/modules/agents/runtime/index.test.ts src/modules/agents/runtime/agent-instructions.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

Commit the Task 3 files with message `feat(api): proxy browser runtime tools`.

---

### Task 4: Web Types And Result API

**Files:**
- Modify: `apps/web/src/modules/agent-messages/agent-message-types.ts`
- Modify: `apps/web/src/modules/agent-messages/api/index.ts`
- Test: `apps/web/src/modules/agent-messages/api/index.test.ts`

- [ ] **Step 1: Write failing web API tests**

Add tests that `startAgentTask` and `continueAgentTask` include `runtimeContributions` in JSON bodies. Add a test that `submitBrowserToolResult` posts to `/api/v1/agents/agent-1/browser-tools/tool-call-1/result` with `{ content: "ok", isError: false }`.

- [ ] **Step 2: Verify tests fail**

Run: `pnpm --filter @hold-rein/web exec vitest run src/modules/agent-messages/api/index.test.ts`

Expected: FAIL because web result API helper and types do not exist.

- [ ] **Step 3: Add web types**

In `agent-message-types.ts`, add browser runtime contribution types matching the API, plus:

```ts
export interface BrowserToolResultInput {
  agentId: string;
  content: string | WebPlugin.TextContent[];
  isError?: boolean;
  toolCallId: string;
}
```

Add `runtimeContributions?: BrowserRuntimeContributions` to `StartTaskInput` and `ContinueTaskInput`.

- [ ] **Step 4: Add API helper**

In `api/index.ts`, export:

```ts
export async function submitBrowserToolResult(
  apiBaseUrl: string,
  input: BrowserToolResultInput,
  fetcher: AgentMessageFetcher = fetch
): Promise<BrowserToolResultInput>;
```

Use `requestData`, POST JSON body `{ content, isError? }`, and encode `agentId` and `toolCallId` in the URL.

- [ ] **Step 5: Verify tests pass**

Run: `pnpm --filter @hold-rein/web exec vitest run src/modules/agent-messages/api/index.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit the Task 4 files with message `feat(web): add browser runtime contribution API`.

---

### Task 5: Web Browser Tool Execution

**Files:**
- Create: `apps/web/src/modules/agent-messages/browser-tools.ts`
- Modify: `apps/web/src/modules/agent-messages/tasks-context/index.tsx`
- Test: `apps/web/src/modules/agent-messages/tasks-context/index.test.tsx`

- [ ] **Step 1: Write failing provider tests**

Add a test that registers an executor for `read_browser_selection`, streams a `browser_tool_call_requested` event with `toolCallId: "tool-call-1"` and `{ scope: "selection" }`, and asserts the executor is called and the result endpoint receives `{ content: "Selected text", isError: false }`.

Add a second test with no registered executor and assert the endpoint receives `isError: true` with a message naming the missing tool.

- [ ] **Step 2: Verify tests fail**

Run: `pnpm --filter @hold-rein/web exec vitest run src/modules/agent-messages/tasks-context/index.test.tsx`

Expected: FAIL because event handling and executor registry do not exist.

- [ ] **Step 3: Add executor registry**

Create `browser-tools.ts` exporting:

```ts
export interface BrowserToolExecutionContext {
  agentId: string;
  arguments: Record<string, unknown>;
  taskId: string;
  toolCallId: string;
  toolName: string;
}

export type BrowserToolExecutor = (
  context: BrowserToolExecutionContext
) => Promise<string | WebPlugin.TextContent[]> | string | WebPlugin.TextContent[];

export function registerBrowserToolExecutor(
  toolName: string,
  executor: BrowserToolExecutor
): () => void;

export async function executeBrowserTool(
  context: BrowserToolExecutionContext
): Promise<{ content: string | WebPlugin.TextContent[]; isError: boolean }>;

export function clearBrowserToolExecutorsForTests(): void;
```

Behavior:

- Registry is keyed by tool name.
- `registerBrowserToolExecutor` returns an unregister function.
- Missing executor returns `isError: true`.
- Thrown executor error returns `isError: true` and the error message.
- Successful executor returns `isError: false`.

- [ ] **Step 4: Handle events in task provider**

In `tasks-context/index.tsx`, add a local parser for `browser_tool_call_requested` payloads. In `handleTaskEvent`, when parsing succeeds, call `executeBrowserTool`, then `submitBrowserToolResult(apiBaseUrl, result, fetcher)`. Catch submission failures and leave task state unchanged.

- [ ] **Step 5: Verify tests pass**

Run: `pnpm --filter @hold-rein/web exec vitest run src/modules/agent-messages/tasks-context/index.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit the Task 5 files with message `feat(web): execute browser runtime tools`.

---

### Task 6: Final Verification

**Files:**
- Modify any touched file that exceeds 500 lines by splitting focused helpers into sibling modules.

- [ ] **Step 1: Check line limits**

Run:

```bash
wc -l apps/api/src/modules/agents/router/index.ts apps/api/src/modules/agents/service/index.ts apps/api/src/modules/agents/runtime/index.ts apps/web/src/modules/agent-messages/tasks-context/index.tsx
```

Expected: every file is at or below 500 lines.

- [ ] **Step 2: Run API verification**

Run:

```bash
pnpm --filter @hold-rein/api exec vitest run src/modules/agents/router/index.test.ts src/modules/agents/service/index.test.ts src/modules/agents/runtime/index.test.ts src/modules/agents/runtime/agent-instructions.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run web verification**

Run:

```bash
pnpm --filter @hold-rein/web exec vitest run src/modules/agent-messages/api/index.test.ts src/modules/agent-messages/tasks-context/index.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run package-level verification**

Run: `pnpm test`
Expected: PASS. If this is too broad or unavailable, run `pnpm --filter @hold-rein/api test` and `pnpm --filter @hold-rein/web test`, then record exact failures before fixing.
