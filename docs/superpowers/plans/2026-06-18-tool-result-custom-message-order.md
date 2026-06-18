# Tool Result and Custom Message Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist and publish the `call_subagent` visible custom message only after its matching tool result.

**Architecture:** Pass `toolCallId` into the subagent-start callback and stage the visible message in a harness-local map. Flush the staged message from the runtime's `message_end` subscriber after the matching `toolResult` has already been persisted and published.

**Tech Stack:** Strict TypeScript, `@earendil-works/pi-agent-core`, Vitest

---

### Task 1: Defer subagent call messages until the matching tool result

**Files:**
- Modify: `apps/api/src/modules/agents/agent-subagents.ts:18-59`
- Modify: `apps/api/src/modules/agents/agent-runtime.ts:100-243`
- Test: `apps/api/src/modules/agents/agent-runtime.test.ts:373-457`

- [ ] **Step 1: Write the failing ordering test**

Update the existing `call_subagent` runtime test to execute the tool and assert
that neither `appendCustomMessageEntry` nor a custom frontend event occurs yet.
Then deliver the matching tool-result events through the harness subscriber:

```ts
await harnessSubscribers[0]?.({
  message: {
    content: [{ text: "started", type: "text" }],
    role: "toolResult",
    toolCallId: "tool-call-1",
    toolName: "call_subagent",
    timestamp: 2
  },
  type: "message_start"
});
await harnessSubscribers[0]?.({
  message: {
    content: [{ text: "started", type: "text" }],
    role: "toolResult",
    toolCallId: "tool-call-1",
    toolName: "call_subagent",
    timestamp: 2
  },
  type: "message_end"
});
```

Assert that frontend roles are `toolResult`, then `custom`, and that the custom
session append occurs only after the matching `message_end`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec vitest run apps/api/src/modules/agents/agent-runtime.test.ts
```

Expected: FAIL because `appendVisibleCustomMessage` still runs inside the tool
execution callback, before any tool-result event.

- [ ] **Step 3: Propagate the tool-call identity**

Change `createCallSubagentTool` so its callback input explicitly includes the
current ID:

```ts
startSubagent: (input: {
  agentName: string;
  prompt: string;
  toolCallId: string;
}) => Promise<AgentToolResult>;
```

Pass the `toolCallId` received by `execute` into this callback.

- [ ] **Step 4: Stage and flush the visible message**

Inside `createHarness`, create a harness-local map keyed by tool-call ID. After
the child agent starts, add the custom-message payload to the map instead of
calling `appendVisibleCustomMessage` immediately.

In the `message_end` branch, first publish the tool-result `message_end`. If the
message role is `toolResult`, take the entry matching `message.toolCallId`, call
`appendVisibleCustomMessage`, and delete the entry only after the append and
frontend publication succeed.

- [ ] **Step 5: Add parallel-call coverage**

Stage two calls with different IDs, deliver their tool-result message events,
and verify each visible message follows its own result. This protects the map
against completion-order coupling.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
pnpm exec vitest run apps/api/src/modules/agents/agent-runtime.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run API typecheck and regression tests**

Run:

```bash
pnpm --filter @hold-rein/api typecheck
pnpm exec vitest run apps/api/src/modules/agents
```

Expected: both commands PASS with no TypeScript errors or failed tests.

- [ ] **Step 8: Review the diff without committing unrelated work**

Run `git diff --check` and inspect only the four relevant API files. Leave the
user's existing uncommitted changes intact; do not create an implementation
commit unless explicitly requested.

