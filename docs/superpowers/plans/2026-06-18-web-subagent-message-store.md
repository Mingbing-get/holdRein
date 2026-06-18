# Web Subagent Message Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store every child agent's messages in a global `agentId`-keyed web state and render those messages recursively inside the parent's visible `callsubagent` message.

**Architecture:** Keep top-level task messages in `AgentTaskState`, add a provider-owned `Record<string, AgentMessage[]>` for child messages, and route each NDJSON subscription to exactly one collection. Discover children from `callsubagent` messages in live streams and stored parent history. Render child collections through a focused component that delegates to `AgentMessageList`, with tool results resolved from the collection currently being rendered.

**Tech Stack:** React 19, strict TypeScript, Ant Design X, Vitest, Testing Library, Vite

---

## File Structure

- Create `apps/web/src/modules/agent-messages/agent-message-collection.ts`: message-only event reduction and safe `callsubagent` identifier extraction shared by task and child flows.
- Create `apps/web/src/modules/agent-messages/agent-message-collection.test.ts`: focused reduction and discovery tests.
- Create `apps/web/src/modules/agent-messages/subagent-message-list.tsx`: child component that accepts only `agentId`, reads global messages, and delegates rendering.
- Modify `apps/web/src/modules/agent-messages/agent-message-reducer.ts`: retain task-specific status and approvals while delegating message updates; stop registering child runs in task state.
- Modify `apps/web/src/modules/agent-messages/agent-message-reducer.test.ts`: replace task-run registration assertions with message ownership assertions.
- Modify `apps/web/src/modules/agent-messages/agent-message-types.ts`: remove obsolete child `runs` state and add an explicit child-message map type.
- Modify `apps/web/src/modules/agent-messages/agent-tasks-context.tsx`: own the global child map, discover identifiers, subscribe once per child, route child events, and expose the getter.
- Create `apps/web/src/modules/agent-messages/agent-tasks-context.subagent.test.tsx`: integration coverage without pushing the existing 500-line provider test over the repository limit.
- Modify `apps/web/src/modules/agent-messages/message-list.tsx`: special-case `callsubagent`, recurse through the child component, and resolve tool results locally.
- Modify `apps/web/src/modules/agent-messages/message-list.test.tsx`: cover child rendering, generic custom fallback, and local tool-result lookup.

### Task 1: Extract message collection reduction and child discovery

**Files:**
- Create: `apps/web/src/modules/agent-messages/agent-message-collection.ts`
- Create: `apps/web/src/modules/agent-messages/agent-message-collection.test.ts`
- Modify: `apps/web/src/modules/agent-messages/agent-message-reducer.ts`
- Modify: `apps/web/src/modules/agent-messages/agent-message-reducer.test.ts`
- Modify: `apps/web/src/modules/agent-messages/agent-message-types.ts`

- [ ] **Step 1: Write failing collection tests**

Add tests proving that a reusable reducer:

```ts
reduceAgentMessages(messages, event)
```

handles `message_start`, `message_delta`, and `message_end` without requiring a
task state. Add extraction tests proving:

```ts
getCalledSubagentId(callMessage) === "agent-child";
getCalledSubagentId(ordinaryCustomMessage) === undefined;
getCalledSubagentId(malformedCallMessage) === undefined;
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
pnpm exec vitest run apps/web/src/modules/agent-messages/agent-message-collection.test.ts
```

Expected: FAIL because `agent-message-collection.ts` and its exports do not exist.

- [ ] **Step 3: Implement the minimal collection module**

Move message upsert, optimistic prompt replacement support where applicable,
assistant delta merging, and safe object parsing behind explicit exported
functions. Keep task completion, approvals, and errors out of this module.

Export explicit APIs:

```ts
export function reduceAgentMessages(
  messages: WebPlugin.AgentMessage[],
  event: AgentEventEnvelope
): WebPlugin.AgentMessage[];

export function getCalledSubagentId(
  message: WebPlugin.AgentMessage
): string | undefined;

export function getCalledSubagentIds(
  messages: WebPlugin.AgentMessage[]
): string[];
```

- [ ] **Step 4: Update task reducer tests before implementation changes**

Replace the two assertions that `callsubagent` adds entries to `state.runs`.
Assert instead that the custom message stays in `state.messages` and that
history loading does not synthesize child runs. Verify the changed test fails
against the current reducer shape.

- [ ] **Step 5: Simplify the task state**

Remove `AgentRun` and `AgentTaskState.runs` from
`agent-message-types.ts`. Delegate message events from the task reducer to the
new message collection reducer, while retaining task status, error, prompt,
approval, and sequence behavior.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
pnpm exec vitest run apps/web/src/modules/agent-messages/agent-message-collection.test.ts apps/web/src/modules/agent-messages/agent-message-reducer.test.ts
```

Expected: both test files PASS.

- [ ] **Step 7: Commit the collection boundary**

```bash
git add apps/web/src/modules/agent-messages/agent-message-collection.ts apps/web/src/modules/agent-messages/agent-message-collection.test.ts apps/web/src/modules/agent-messages/agent-message-reducer.ts apps/web/src/modules/agent-messages/agent-message-reducer.test.ts apps/web/src/modules/agent-messages/agent-message-types.ts
git commit -m "refactor(web): separate agent message reduction"
```

### Task 2: Add the global child message store and route subscriptions

**Files:**
- Modify: `apps/web/src/modules/agent-messages/agent-tasks-context.tsx`
- Create: `apps/web/src/modules/agent-messages/agent-tasks-context.subagent.test.tsx`
- Reuse: `apps/web/src/modules/agent-messages/agent-tasks-context-test-utils.ts`

- [ ] **Step 1: Write failing provider tests**

Build a provider probe that reads both APIs:

```ts
const parent = getTaskState("task-1")?.messages;
const child = getSubagentMessages("agent-child");
```

Feed a parent stream containing a `callsubagent` message and a child stream
containing an assistant message. Assert:

```ts
expect(parent).toContainEqual(callSubagentMessage);
expect(parent).not.toContainEqual(childAssistantMessage);
expect(child).toEqual([childAssistantMessage]);
```

Also assert that repeated discovery of the same identifier opens only one
`/api/v1/agents/agent-child/events` request.

- [ ] **Step 2: Run the provider test and verify RED**

Run:

```bash
pnpm exec vitest run apps/web/src/modules/agent-messages/agent-tasks-context.subagent.test.tsx
```

Expected: FAIL because `getSubagentMessages` is absent and child events still
flow into task messages.

- [ ] **Step 3: Add explicit global state and context API**

Add:

```ts
const [subagentMessagesById, setSubagentMessagesById] =
  useState<SubagentMessagesById>({});
```

Expose an explicitly typed `getSubagentMessages(agentId)` that returns the
stored array or a shared empty array. Do not expose subscription controllers.

- [ ] **Step 4: Discover children without overwriting messages**

For loaded parent history and every received parent or child message, collect
valid `callsubagent` identifiers. Initialize only missing keys:

```ts
if (!(agentId in current)) next[agentId] = [];
```

Never replace an existing child array during duplicate discovery.

- [ ] **Step 5: Route task and child streams separately**

Keep top-level subscriptions routing events through `reduceAgentTaskState`.
Add provider-owned child subscriptions that route events through
`reduceAgentMessages` into `subagentMessagesById[agentId]`. Remove the old
effect that interpreted `taskState.runs` as child subscriptions and replace
`addRun` calls with direct task status updates.

Ensure both routing paths inspect newly completed messages for descendant
`callsubagent` identifiers. Continue using the shared controller map so each
`agentId` has at most one active request and provider unmount aborts all
requests.

- [ ] **Step 6: Add stored-history and nested discovery tests**

Extend the new test file with two tests written before any further production
changes:

- stored parent history containing `callsubagent` starts the child subscription;
- a child stream containing `callsubagent` starts a descendant subscription and
  stores descendant messages under the descendant identifier.

Run the tests to observe the intended failures, then make the minimum discovery
changes required for them to pass.

- [ ] **Step 7: Run provider regression tests**

Run:

```bash
pnpm exec vitest run apps/web/src/modules/agent-messages/agent-tasks-context.test.tsx apps/web/src/modules/agent-messages/agent-tasks-context.subagent.test.tsx
```

Expected: PASS with no React act warnings or unhandled stream errors.

- [ ] **Step 8: Check file limits**

Run:

```bash
wc -l apps/web/src/modules/agent-messages/agent-tasks-context.tsx apps/web/src/modules/agent-messages/agent-tasks-context.test.tsx apps/web/src/modules/agent-messages/agent-tasks-context.subagent.test.tsx
```

Expected: every file is at or below 500 lines. If the provider would exceed the
limit, extract child discovery and subscription helpers into
`apps/web/src/modules/agent-messages/subagent-message-store.ts`, exporting its
public API explicitly.

- [ ] **Step 9: Commit the global store**

```bash
git add apps/web/src/modules/agent-messages/agent-tasks-context.tsx apps/web/src/modules/agent-messages/agent-tasks-context.subagent.test.tsx apps/web/src/modules/agent-messages/agent-message-types.ts apps/web/src/modules/agent-messages/subagent-message-store.ts
git commit -m "feat(web): store subagent messages by agent id"
```

Only add `subagent-message-store.ts` in the command if extraction was required.

### Task 3: Render child conversations inside `callsubagent`

**Files:**
- Create: `apps/web/src/modules/agent-messages/subagent-message-list.tsx`
- Modify: `apps/web/src/modules/agent-messages/message-list.tsx`
- Modify: `apps/web/src/modules/agent-messages/message-list.test.tsx`

- [ ] **Step 1: Write failing rendering tests**

Extend the context mock with:

```ts
getSubagentMessages: (agentId: string) =>
  agentId === "agent-child" ? childMessages : [];
```

Add tests proving:

- a valid `callsubagent` message renders its outer `Think` and the child's
  assistant content;
- an ordinary custom message retains its current text content;
- malformed `callsubagent` details fall back to generic custom rendering.

- [ ] **Step 2: Run rendering tests and verify RED**

Run:

```bash
pnpm exec vitest run apps/web/src/modules/agent-messages/message-list.test.tsx
```

Expected: the child assistant content is absent because all custom messages use
the generic text body.

- [ ] **Step 3: Add the focused child component**

Implement an explicitly typed component:

```tsx
export function SubagentMessageList({ agentId }: { agentId: string }) {
  const { getSubagentMessages } = useAgentTasks();
  return <AgentMessageList messages={getSubagentMessages(agentId)} />;
}
```

Keep subscription and data mutation out of the component.

- [ ] **Step 4: Special-case valid `callsubagent` messages**

Use the shared identifier extractor in `AgentMessageItem`. Preserve the current
`Think` title, icon, expansion behavior, and visibility handling. Replace only
the body of a valid call with `SubagentMessageList`; retain generic rendering
for all other custom messages.

- [ ] **Step 5: Write a failing local tool-result test**

Pass a child collection containing both an assistant tool call and its matching
tool result directly to `AgentMessageList`, while the mocked parent task has no
tool result. Assert that expanding the tool displays the child result.

Expected before implementation: FAIL because `ToolCallMessageItem` searches the
active task state.

- [ ] **Step 6: Resolve tool results from the rendered collection**

Pass the current `messages` collection through `AgentMessageItem` and
`AssistantMessageItem` to `ToolCallMessageItem`. Find matching `toolResult`
messages in that collection. Remove the active-workspace/task lookup from the
message renderer.

- [ ] **Step 7: Run rendering tests and verify GREEN**

Run:

```bash
pnpm exec vitest run apps/web/src/modules/agent-messages/message-list.test.tsx
```

Expected: PASS, including recursive child content and local tool results.

- [ ] **Step 8: Commit recursive rendering**

```bash
git add apps/web/src/modules/agent-messages/subagent-message-list.tsx apps/web/src/modules/agent-messages/message-list.tsx apps/web/src/modules/agent-messages/message-list.test.tsx
git commit -m "feat(web): render nested subagent conversations"
```

### Task 4: Full verification

**Files:**
- Verify all modified web files

- [ ] **Step 1: Run the focused agent-message suite**

```bash
pnpm exec vitest run apps/web/src/modules/agent-messages
```

Expected: all agent-message tests PASS.

- [ ] **Step 2: Run the full test suite**

```bash
pnpm test
```

Expected: all repository tests PASS.

- [ ] **Step 3: Run strict TypeScript and the web build**

```bash
pnpm --filter @hold-rein/web typecheck
pnpm --filter @hold-rein/web build
```

Expected: both commands exit successfully.

- [ ] **Step 4: Run ESLint and file-size checks**

```bash
pnpm lint
wc -l apps/web/src/modules/agent-messages/*.ts apps/web/src/modules/agent-messages/*.tsx
```

Expected: ESLint succeeds and no source or test file exceeds 500 lines.

- [ ] **Step 5: Review the final diff**

```bash
git diff --check
git status --short
```

Confirm the diff contains only the normalized child store, subscription
routing, recursive renderer, tests, and supporting refactors described in the
approved design.

