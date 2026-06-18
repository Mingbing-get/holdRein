export function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify({ code: 0, data, msg: "ok" }), {
    headers: { "Content-Type": "application/json" },
    status: 200
  });
}

export function startResult() {
  return {
    agentId: "agent-1",
    sessionId: "session-1",
    status: "running",
    task: {
      id: "task-1",
      initialUserMessage: "Inspect the project",
      lastContinuedAt: "2026-06-08T00:00:00.000Z",
      lastModelName: "gpt-4.1",
      lastModelProvider: "openai",
      lastModelProviderSource: "built_in",
      status: "running",
      title: "",
      workspaceId: "workspace-1"
    },
    workspace: { id: "workspace-1", name: "workspace", path: "/workspace" }
  };
}

export function streamResponse(
  start: (controller: ReadableStreamDefaultController<Uint8Array>) => void
) {
  return new Response(new ReadableStream({ start }), { status: 200 });
}
