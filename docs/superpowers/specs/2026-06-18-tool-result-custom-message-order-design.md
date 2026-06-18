# Tool Result and Custom Message Ordering

## Problem

`call_subagent` currently appends its visible custom message while the tool is
still executing. The agent harness appends the corresponding `toolResult` only
after the tool returns, producing this invalid session order:

`assistant(toolCall) -> custom -> toolResult`

The custom message is converted to an LLM user message, so placing it between a
tool call and its result can make the next provider request invalid.

## Design

Associate the visible custom message with the current `toolCallId` and defer
both persistence and frontend publication. Each harness keeps a map of pending
visible messages keyed by `toolCallId`.

The `call_subagent` tool starts the child agent and records the pending message,
then returns its normal tool result. When the runtime subscriber receives the
matching `toolResult` `message_end`, the harness has already persisted that
result. The runtime then appends and publishes the pending custom message and
removes it from the map.

The resulting order is the same in session storage and frontend events:

`assistant(toolCall) -> toolResult -> custom`

Keying by `toolCallId` keeps parallel tool calls independent and preserves the
tool-result source order established by the harness.

## Failure Handling

Invalid tool input never creates a pending message. A successfully started
subagent always returns a tool result, including when later tool processing
reports an error. The pending entry is removed only after its custom message is
successfully appended and published, so persistence failures remain visible to
the harness instead of silently dropping the message.

## Tests

- Verify the custom message is neither persisted nor published during tool
  execution.
- Verify the matching `toolResult` is published before the custom message.
- Verify multiple pending calls are matched by `toolCallId` rather than
  completion timing.

## Subagent Completion Lifecycle

When a child harness emits `agent_end`, its own contribution must receive
`onAgentEnd` with the child session and child messages. If the hook returns a
prompt, the child continues and remains running. Only when the child has no
continuation is it marked completed and its result delivered to the parent.

`continueOrEndTask` therefore reports whether it continued or is still waiting,
leaving the caller responsible for either completing a child or emitting the
root task's `task_end`. This keeps child and parent session contexts separate.
