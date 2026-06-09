# Task Message Persistence Design

## Goal

Persist recoverable task conversation messages, restore them after refresh, and
continue an existing task with its previous Harness context. The browser uses a
Harness-shaped message model without usage, cost, diagnostics, or provider
response identifiers.

## Stored Message Contract

`task_messages` stores one completed message per row and binds every row to a
task. The JSON payload uses a recoverable Harness-shaped message contract.
Assistant messages omit `usage`, `diagnostics`, `responseId`, and
`responseModel`. Restoring an assistant message for Harness fills `usage` with
zero values.

Rows contain a stable message id, task id, run agent id, monotonically
increasing task sequence, role, JSON payload, and timestamps. The pair
`(task_id, sequence)` is unique.

Only completed Harness messages are persisted. Stream deltas and approval
requests are not persisted.

## Runtime And API Flow

Starting a task creates the task before starting its Agent run. The runtime
receives the task id and persists every `message_end` event.

Continuing a task:

1. Loads the task, workspace, and stored messages.
2. Restores stored messages to valid Harness `AgentMessage` values.
3. Creates a new Agent run and session with the restored messages as context.
4. Prompts the Harness with the new user message.
5. Appends completed messages to the same task.

The API exposes:

- `GET /api/v1/agents/tasks/:taskId/messages`
- `POST /api/v1/agents/tasks/:taskId/continue`

The history endpoint returns stored messages directly because they already use
the browser-safe contract.

## Streaming Contract

The event stream emits browser-safe events:

- `message_start` with a stable message id and initial message;
- `message_delta` with only the Harness assistant message event;
- `message_end` with the final stored message;
- `approval_requested` and `agent_error` as transient events.

Internal Harness lifecycle events are not sent to the browser. The browser
merges assistant deltas into the active assistant message and replaces it with
the final message on `message_end`.

## Browser State

Browser messages use Harness roles and structured content blocks. Opening an
existing task loads its message history. Submitting while an existing task is
active calls the continue endpoint; submitting without an active task starts a
new task.

Renderers derive visible text, thinking, and tool calls from structured content
without converting messages to the old `kind/content/payload` format.

## Safety And Limits

Provider response metadata and usage/cost are not stored. Tool result details
are omitted from the stored/browser contract. Content required for model
continuity, including thinking and tool-call signatures, is preserved.

Large message output limits are outside this change; existing Harness output
truncation remains responsible for controlling tool output size.

## Testing

Tests cover schema constraints, repository ordering, message sanitization and
restoration, runtime persistence, continue-task context restoration, API
history/continue contracts, browser delta merging, history loading, continued
submission, rendering, type checking, linting, and builds.
