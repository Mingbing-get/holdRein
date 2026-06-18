# Web Subagent Message Store Design

## Goal

Keep child-agent messages separate from the parent task message list while
preserving each visible `callsubagent` message as the point where the child
conversation is rendered.

## Current Problem

The web provider discovers child agents from visible `callsubagent` messages,
but routes every subscribed child event into the parent task state. Parent and
child messages therefore share `taskStates[taskId].messages`, losing the
message ownership boundary and making nested rendering depend on ordering.

Tool-result rendering also reads from the active task message list rather than
the message list currently being rendered. After child messages are separated,
that lookup would fail for tool calls made by a child agent.

## State Model

`AgentTasksProvider` will own a normalized, global child-message map in
addition to the existing task state:

```ts
type SubagentMessagesById = Record<string, WebPlugin.AgentMessage[]>;
```

The object key is the child `agentId`; the value contains only that agent's
messages. Operational subscription state remains in the existing private
`Map<string, AbortController>` and is not exposed as application state.

Parent task state continues to contain parent messages, including the visible
`callsubagent` and `subagent_result` custom messages. Child messages are never
appended to `taskStates[taskId].messages`.

The context exposes a read operation with an empty-list fallback:

```ts
getSubagentMessages(agentId: string): WebPlugin.AgentMessage[];
```

## Discovery And Subscription Flow

When a parent or child stream receives a visible `callsubagent` message, the
provider reads `message.details.agentId`. A valid, previously unseen identifier
creates an empty entry in `SubagentMessagesById`.

A provider-level effect observes the child-message map and opens one NDJSON
subscription per untracked child identifier. Child subscription events are
reduced into `subagentMessagesById[agentId]`; the task identifier is not used as
the event destination.

Discovery applies equally to stored parent history and live events. It also
applies to child messages, so a child that calls another child creates another
entry in the same flat global map. This supports arbitrary nesting without a
nested state structure.

The existing provider-owned subscription lifecycle remains responsible for
deduplication and cleanup. Rendering components do not open or close network
subscriptions.

## Message Reduction

Message-event reduction will be reusable for both parent and child message
collections. Parent-only task fields such as completion status, unread state,
and pending approvals remain in task reduction. Child event reduction updates
only the child message array.

The existing child registration behavior in `registerSubagentRuns` will no
longer add child runs to a parent task. Child discovery instead initializes the
global child-message entry. Parent run tracking may remain for top-level task
runs where required by the current task subscription lifecycle.

Malformed `callsubagent` details, including a missing or non-string `agentId`,
are rendered as ordinary custom messages and do not create a subscription.

## Rendering

`AgentMessageList` remains the common renderer for parent and child message
arrays.

For an ordinary visible custom message, `AgentMessageItem` keeps the existing
`Think` rendering. For `customType === "callsubagent"` with a valid child
identifier, it renders the same outer `Think`, but its child becomes a focused
subagent component:

```tsx
<SubagentMessages agentId={agentId} />
```

`SubagentMessages` accepts only `agentId`, reads the corresponding messages
through `getSubagentMessages`, and renders them with `AgentMessageList`. Nested
`callsubagent` messages therefore recurse through the same component path.

Tool-call result lookup will use the message collection passed to the current
`AgentMessageList`. This ensures a child tool call resolves its result from the
same child's messages rather than from the active parent task.

## Refresh Scope

This change preserves the current runtime event-replay behavior and does not
add a backend endpoint for loading child session history by `agentId`. Parent
history can rediscover child identifiers from stored `callsubagent` messages,
but child messages that are no longer present in the in-memory backend event
bus are outside this change's recovery guarantee.

## Error Handling

- Subscription failures retain the current provider-level failure handling.
- A missing child map entry renders an empty child message list.
- Invalid `callsubagent` details fall back to the generic custom-message view.
- Duplicate discovery of an `agentId` must not replace accumulated messages or
  create a second subscription.

## Testing

Reducer and provider tests will verify that:

- a parent `callsubagent` message stays in the parent message array;
- child events are appended only to the global child entry;
- child events do not appear in the parent task message array;
- duplicate discovery creates only one subscription;
- stored parent history discovers child identifiers;
- nested `callsubagent` messages discover and subscribe to descendants.

Rendering tests will verify that:

- ordinary custom messages keep their existing rendering;
- `callsubagent` renders `SubagentMessages` inside its `Think`;
- the component reads messages by `agentId` and delegates to
  `AgentMessageList`;
- child tool calls find tool results in the child message collection.

