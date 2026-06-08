# Web Agent Task Messages Design

**Goal**

Connect the web chat workspace to the agent API so a prompt starts a task,
updates global workspace navigation immediately, keeps receiving agent events
while the user changes views, and renders real task messages instead of the
current examples.

## Scope

This iteration supports creating a new task from a prompt and receiving its
in-memory agent events for the lifetime of the web application.

The design reserves an API and state boundary for sending later prompts to the
same task, but does not implement task continuation, message persistence, or
subscription recovery after a page refresh.

## Identity Model

- `workspaceId` identifies a persisted working directory.
- `taskId` identifies the user-visible task and is the primary key used by web
  message state and UI components.
- `agentId` identifies one backend runtime execution. It remains an internal
  run detail used by the global subscription layer and approval requests.
- One task may contain multiple agent runs in the future.

The web UI must not use `agentId` to select or render a task. The start-agent
response may contain `agentId` because the current backend event endpoint
requires it, but only the agent task state layer may consume it.

## State Boundaries

`AppWorkspaceProvider` continues to own low-frequency navigation state:

- available workspaces and their task summaries;
- active workspace and active task;
- selected model.

A new `AgentTasksProvider` owns high-frequency task execution state:

- messages indexed by `taskId`;
- active runs indexed by `taskId`;
- task status and errors;
- open NDJSON subscriptions and sequence cursors.

`AgentTasksProvider` is mounted beside and inside `AppWorkspaceProvider` at the
application root. It remains mounted while chat components or alternate main
views mount and unmount. Streaming updates therefore do not interrupt when the
user switches tasks or views, and they do not cause workspace navigation
consumers to rerender for every message event.

The provider exposes task-focused operations:

```ts
startTask(input: StartTaskInput): Promise<void>
getTaskState(taskId: string): AgentTaskState | undefined
```

Its public shape reserves a future `continueTask(taskId, prompt)` operation.

## Starting A Task

The chat sender calls `startTask` with the active workspace path, selected
provider and model, and submitted prompt.

`startTask` performs the following flow:

1. Add the submitted prompt as the task's user message once the API returns the
   new `taskId`.
2. Call `POST /api/v1/agents/start`.
3. Upsert the returned workspace and task into `AppWorkspaceProvider`.
4. Use the submitted prompt as the task's temporary navigation title.
5. Select the returned workspace and task.
6. Register the returned runtime run and open its NDJSON event subscription.
7. Request `GET /api/v1/agents/tasks/:taskId/title`.
8. Replace the temporary navigation title when title generation completes.

If task startup fails, the sender remains on the current task and reports the
failure through the sender submission promise. No incomplete navigation task
is inserted because the backend has not returned a stable `taskId`.

## Workspace Updates

The workspace context gains explicit operations rather than making feature
code manipulate nested arrays directly:

```ts
upsertStartedTask(workspace, task, temporaryTitle): void
updateTaskTitle(taskId, title): void
```

`upsertStartedTask` inserts a new workspace when necessary, otherwise inserts
or replaces its task at the beginning of the task list. The visible title is
the generated title when non-empty and otherwise the submitted prompt.

Existing navigation tasks with an empty title also render
`initialUserMessage` as their fallback label.

## Event Subscription And Message Management

The browser consumes the existing NDJSON endpoint:

```text
GET /api/v1/agents/:agentId/events?afterSequence=<lastSequence>
```

Each active run owns an abort controller and its latest sequence. The
subscription parser buffers partial chunks, parses complete newline-delimited
JSON envelopes, and dispatches them into the task message reducer. A completed
or failed connection updates the task state without removing already received
messages.

The state layer normalizes backend envelopes into a small renderable message
model. Unknown event types are preserved as fallback messages so new backend
events do not break the chat view.

The initial renderer set covers:

- submitted user prompts;
- assistant message content and streaming updates;
- reasoning or thinking events;
- tool events;
- approval requests;
- agent errors;
- unknown events.

Message normalization and message rendering remain separate. Reducer and
normalizer files contain no React components; renderer files receive normalized
messages and contain no subscription logic.

## Module Structure

```text
apps/web/src/modules/agent-messages/
├── agent-message-api.ts
├── agent-message-reducer.ts
├── agent-message-types.ts
├── agent-tasks-context.tsx
├── message-list.tsx
├── index.ts
└── renderers/
    ├── assistant-message.tsx
    ├── approval-message.tsx
    ├── fallback-message.tsx
    ├── thinking-message.tsx
    ├── tool-message.tsx
    └── user-message.tsx
```

Files remain below 500 lines and public TypeScript types are explicit.

## Error Handling

- Invalid or failed start requests reject the sender submission and keep its
  prompt available for retry.
- Title generation failure leaves the prompt-based temporary title in place.
- Malformed NDJSON lines are represented as fallback error messages while the
  subscription continues reading later lines.
- Subscription failures set the affected task's error state without affecting
  other task subscriptions.

## Testing

Tests are added before implementation and cover:

- workspace task upsert, prompt title fallback, and generated title
  replacement;
- start-agent request and title request API contracts;
- NDJSON parsing across partial chunks;
- reducer normalization for user, assistant, reasoning, tool, approval, error,
  and unknown events;
- provider subscriptions remaining active while chat views unmount;
- sender submission starting a task and rendering messages for the active
  `taskId`;
- navigation immediately showing the prompt and later replacing it with the
  generated title.

The final verification runs the focused web tests, the complete test suite,
web type checking, ESLint, and the web Vite build.
