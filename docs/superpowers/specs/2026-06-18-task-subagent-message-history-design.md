# Task Subagent Message History Design

## Goal

Make the task message history endpoint return the parent conversation together
with every persisted descendant agent conversation and lifecycle status. The web
client can then restore completed child conversations without opening redundant
event streams, while still subscribing to children that are running.

## API Contract

`GET /api/v1/agents/tasks/:taskId/messages` returns:

```ts
interface TaskMessageHistory {
  messages: AgentMessage[];
  subagents: TaskSubagentHistory[];
}

interface TaskSubagentHistory {
  agentId: string;
  messages: AgentMessage[];
  parentAgentId: string;
  status: "running" | "completed";
}
```

`messages` contains only the top-level task session. `subagents` is a flat list
of every child and descendant associated with the task. The existing
`parentAgentId` relationship preserves the tree without coupling the transport
format to a fixed nesting depth.

Unknown tasks and tasks without a stored parent session keep the existing
empty-history semantics, represented by `{ messages: [], subagents: [] }`.

## Persistence

Extend the strict SQLite `subagents` table with required session metadata:

- `session_id`
- `session_path`
- `session_created_at`

The runtime creates the child session and reads its metadata before prompting
the child harness. It persists the running row with that metadata, then starts
the harness using the already-created session. A synchronous harness startup
failure deletes the new row before propagating the error. This ordering avoids
a race in which child events could be emitted before the recovery metadata is
durable.

The repository adds a task-scoped query returning all descendant rows for a
task. The task foreign-key cascade remains responsible for cleanup.

Existing databases receive the new columns through additive migrations.
Because old rows may lack session metadata, the Drizzle model and response
loader tolerate nullable legacy values even though newly created rows always
store all three fields.

## Backend History Loading

The agents service receives the subagent repository alongside the existing
workspace repository. Loading task history performs these independent steps:

1. Load the parent task and workspace.
2. Load the parent session messages when session metadata is available.
3. Query every subagent row for the task.
4. For each row with complete session metadata, load messages through the
   runtime's existing session reader.
5. Return the parent messages and the flat child history list.

One missing or unreadable child session produces an empty `messages` array for
that child rather than failing the parent and sibling history. Parent-session
loading retains its existing behavior.

## Runtime Lifecycle

When `callsubagent` starts a child, the runtime persists the generated agent
identifier, parent identifier, task identifier, running status, timestamps, and
the new child session metadata. On terminal completion, it updates the same row
to `completed`. Continuations do not change the running status or session.

The session stored in the visible `callsubagent` message remains useful display
metadata but is no longer the source of truth for history recovery.

## Web State And Subscription Flow

Replace the child message-only map with records keyed by `agentId`:

```ts
interface SubagentState {
  messages: WebPlugin.AgentMessage[];
  parentAgentId: string;
  status: "running" | "completed";
}
```

When task history loads, the provider initializes every returned subagent
record directly. Discovery from live `callsubagent` messages remains necessary
for newly started children; those records begin as `running` with empty
messages.

The subscription effect opens a stream only when a child record is `running`
and no subscription already exists. A child terminal event marks the record
`completed`, while normal message events continue to update only that child's
message collection. Completed historical children never subscribe.

Rendering continues to resolve messages by `agentId`, so the existing recursive
subagent UI does not need to mirror the transport shape.

## Error Handling

- Invalid or incomplete legacy child session metadata returns empty child
  messages while preserving status and relationship information.
- A child session read failure is isolated to that child.
- Duplicate live discovery preserves restored messages and status.
- Subscription failures retain accumulated child messages and do not affect
  the parent task state.
- Malformed `callsubagent` details remain renderable but do not create a child
  state or subscription.

## Testing

Backend tests cover:

- schema columns and additive migration behavior;
- in-memory and SQLite repository task queries and session fields;
- runtime persistence of child session metadata and startup rollback;
- service history containing parent messages and all descendant histories;
- completed/running status preservation;
- isolation of missing or unreadable child sessions;
- router response contract.

Web tests cover:

- API parsing of the structured response;
- initialization of restored child messages and statuses;
- subscriptions opened only for running children;
- completed children not subscribed;
- live child discovery and nested child discovery;
- child terminal events transitioning local status to completed;
- duplicate discovery preserving restored state.
