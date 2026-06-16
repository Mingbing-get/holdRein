import type {
  AgentEventEnvelope,
  ApprovalDecisionInput,
  ContinueTaskInput,
  InterruptTaskResult,
  StartTaskInput,
  StartTaskResult,
  TaskTitleResult
} from "./agent-message-types";
import type { WebPlugin } from "@hold-rein/plugin-web";

interface ApiResponse<T> {
  code: number;
  data: T;
  msg: string;
}

export type AgentMessageFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export async function startAgentTask(
  apiBaseUrl: string,
  input: StartTaskInput,
  fetcher: AgentMessageFetcher = fetch
): Promise<StartTaskResult> {
  return requestData<StartTaskResult>(
    fetcher,
    `${normalizeApiBaseUrl(apiBaseUrl)}/api/v1/agents/start`,
    {
      body: JSON.stringify(input),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    }
  );
}

export async function fetchTaskTitle(
  apiBaseUrl: string,
  taskId: string,
  fetcher: AgentMessageFetcher = fetch
): Promise<TaskTitleResult> {
  return requestData<TaskTitleResult>(
    fetcher,
    `${normalizeApiBaseUrl(apiBaseUrl)}/api/v1/agents/tasks/${encodeURIComponent(taskId)}/title`
  );
}

export async function fetchTaskMessages(
  apiBaseUrl: string,
  taskId: string,
  fetcher: AgentMessageFetcher = fetch
): Promise<WebPlugin.AgentMessage[]> {
  return requestData<WebPlugin.AgentMessage[]>(
    fetcher,
    `${normalizeApiBaseUrl(apiBaseUrl)}/api/v1/agents/tasks/${encodeURIComponent(taskId)}/messages`
  );
}

export async function continueAgentTask(
  apiBaseUrl: string,
  taskId: string,
  input: ContinueTaskInput,
  fetcher: AgentMessageFetcher = fetch
): Promise<StartTaskResult> {
  return requestData<StartTaskResult>(
    fetcher,
    `${normalizeApiBaseUrl(apiBaseUrl)}/api/v1/agents/tasks/${encodeURIComponent(taskId)}/continue`,
    {
      body: JSON.stringify(input),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    }
  );
}

export async function cancelAgentTask(
  apiBaseUrl: string,
  taskId: string,
  fetcher: AgentMessageFetcher = fetch
): Promise<InterruptTaskResult> {
  return requestData<InterruptTaskResult>(
    fetcher,
    `${normalizeApiBaseUrl(apiBaseUrl)}/api/v1/agents/tasks/${encodeURIComponent(taskId)}/interrupt`,
    { method: "POST" }
  );
}

export async function decideAgentApproval(
  apiBaseUrl: string,
  input: ApprovalDecisionInput,
  fetcher: AgentMessageFetcher = fetch
): Promise<ApprovalDecisionInput> {
  return requestData<ApprovalDecisionInput>(
    fetcher,
    `${normalizeApiBaseUrl(apiBaseUrl)}/api/v1/agents/${encodeURIComponent(input.agentId)}/approvals/${encodeURIComponent(input.approvalId)}`,
    {
      body: JSON.stringify({
        approved: input.approved,
        ...(input.reason === undefined ? {} : { reason: input.reason })
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    }
  );
}

export async function subscribeToAgentEvents(
  apiBaseUrl: string,
  input: { afterSequence?: number; agentId: string; signal?: AbortSignal },
  listener: (event: AgentEventEnvelope) => void,
  fetcher: AgentMessageFetcher = fetch
): Promise<void> {
  const eventsUrl = `${normalizeApiBaseUrl(apiBaseUrl)}/api/v1/agents/${encodeURIComponent(input.agentId)}/events`;
  const url =
    input.afterSequence === undefined
      ? eventsUrl
      : `${eventsUrl}?afterSequence=${input.afterSequence}`;

  const response = await fetcher(url, {
    ...(input.signal ? { signal: input.signal } : {})
  });

  if (!response.ok || !response.body) {
    throw new Error("Failed to subscribe to agent events");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const result = await reader.read();
    buffer += decoder.decode(result.value, { stream: !result.done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.trim()) {
        listener(JSON.parse(line) as AgentEventEnvelope);
      }
    }

    if (result.done) {
      if (buffer.trim()) {
        listener(JSON.parse(buffer) as AgentEventEnvelope);
      }
      return;
    }
  }
}

async function requestData<T>(
  fetcher: AgentMessageFetcher,
  url: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetcher(url, init);

  if (!response.ok) {
    throw new Error("Agent request failed");
  }

  const payload = (await response.json()) as ApiResponse<T>;
  return payload.data;
}

function normalizeApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/$/, "");
}
