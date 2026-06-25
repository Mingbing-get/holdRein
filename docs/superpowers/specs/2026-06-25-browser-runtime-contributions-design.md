# Browser Runtime Contributions

## Goal

Allow each agent start or continue request to include temporary browser runtime
contributions:

- Tool schemas for tools that execute in the browser.
- Inline skills that are available only for the current run.
- Additional system prompt text that is available only for the current run.

The browser tool request carries schema only. Tool implementation code stays in
the web runtime and is matched by tool name.

## Request Contract

`StartTaskInput` and `ContinueTaskInput` accept an optional
`runtimeContributions` object:

```ts
interface BrowserRuntimeContributions {
  tools?: BrowserRuntimeToolSchema[];
  skills?: BrowserRuntimeSkill[];
  systemPrompts?: string[];
}

interface BrowserRuntimeToolSchema {
  description?: string;
  inputSchema: unknown;
  name: string;
}

interface BrowserRuntimeSkill {
  content: string;
  description?: string;
  name: string;
}
```

The API validates names, sizes, and array limits before starting the run.
Runtime contributions are not persisted to workspace settings or global plugin
state.

## Server Flow

The agent service passes validated runtime contributions into `RunAgentInput`.
When the runtime creates a harness it merges:

1. Server plugin contributions.
2. Request-scoped browser tool proxies.
3. Request-scoped inline skills.
4. Request-scoped system prompts.

Each browser tool proxy exposes the provided schema to the model. When the model
calls the tool, the proxy:

1. Creates a pending browser tool call keyed by `agentId` and `toolCallId`.
2. Emits a `browser_tool_call_requested` event with tool name, call id, and
   arguments.
3. Waits for the browser result endpoint to resolve the pending call.
4. Returns that result to the harness.

Pending calls are removed when they complete, time out, or the agent is
interrupted.

## Browser Flow

The web runtime keeps a local registry of browser tool executors keyed by tool
name. Sender code attaches the selected tool schemas, inline skills, and system
prompts to each start or continue request.

`AgentTasksProvider` listens for `browser_tool_call_requested` events. For each
event it:

1. Finds a matching local executor by tool name.
2. Runs the executor with the tool arguments and task context.
3. Posts the result to the server.

If no executor is registered, or execution fails, the browser posts an error
result so the model receives a normal tool failure instead of hanging.

## Result Endpoint

The API adds:

`POST /api/v1/agents/:agentId/browser-tools/:toolCallId/result`

The request body is:

```ts
interface BrowserToolResultBody {
  content: string | Array<{ type: "text"; text: string }>;
  isError?: boolean;
}
```

The service rejects unknown or already completed calls. Duplicate results are
treated as not found or conflict rather than resolving twice.

## Events

The server emits browser tool call events through the existing NDJSON agent
event stream:

```ts
interface BrowserToolCallRequestedEvent {
  agentId: string;
  payload: {
    arguments: Record<string, unknown>;
    toolCallId: string;
    toolName: string;
  };
  type: "browser_tool_call_requested";
}
```

The existing message stream remains the source of truth for assistant tool call
content and final tool result messages.

## Error Handling

- Browser tool calls time out, with a default of 60 seconds.
- Agent interruption rejects all pending browser tool calls for that agent.
- Browser disconnects do not immediately fail a call; the timeout handles it.
- Unknown tool executors produce browser-submitted error results.
- Invalid runtime contribution payloads reject the start or continue request.
- Tool output size is capped before returning to the harness.

## Testing

API tests cover request validation for start and continue bodies, including
invalid runtime contribution shapes.

Runtime tests cover:

- Browser schemas becoming active harness tools.
- Tool-call events emitted with the expected payload.
- Posted browser results resolving the pending tool call.
- Missing result timeout.
- Interrupt cleanup.
- Inline skills and system prompts being merged into harness resources and
  prompt text.

Web tests cover:

- Start and continue requests include selected runtime contributions.
- Browser tool call events invoke registered executors.
- Executor success posts a non-error result.
- Missing executor and thrown executor errors post error results.

