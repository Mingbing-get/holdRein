import type { ApiResponse, ScheduledTask, ScheduledTaskInput } from "./scheduled-tasks-types";

export async function fetchScheduledTasks(
  apiBaseUrl: string,
  workspacePath?: string
): Promise<ScheduledTask[]> {
  const response = await fetch(createScheduledTasksUrl(apiBaseUrl, workspacePath));
  const payload = (await response.json()) as ApiResponse<ScheduledTask[]>;

  if (!response.ok) {
    throw new Error(payload.msg || "Failed to load scheduled tasks");
  }

  return payload.data;
}

export async function createScheduledTask(
  apiBaseUrl: string,
  input: ScheduledTaskInput
): Promise<ScheduledTask> {
  return requestScheduledTaskMutation(
    createScheduledTasksUrl(apiBaseUrl),
    {
      body: JSON.stringify(input),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    },
    "Failed to create scheduled task"
  );
}

export async function updateScheduledTask(
  apiBaseUrl: string,
  id: string,
  input: Partial<ScheduledTaskInput>
): Promise<ScheduledTask> {
  return requestScheduledTaskMutation(
    createScheduledTaskUrl(apiBaseUrl, id),
    {
      body: JSON.stringify(input),
      headers: { "Content-Type": "application/json" },
      method: "PATCH"
    },
    "Failed to update scheduled task"
  );
}

export async function setScheduledTaskEnabled(
  apiBaseUrl: string,
  id: string,
  enabled: boolean
): Promise<ScheduledTask> {
  return requestScheduledTaskMutation(
    `${createScheduledTaskUrl(apiBaseUrl, id)}/${enabled ? "enable" : "disable"}`,
    { method: "POST" },
    "Failed to update scheduled task status"
  );
}

export async function deleteScheduledTask(
  apiBaseUrl: string,
  id: string
): Promise<{ id: string }> {
  const response = await fetch(createScheduledTaskUrl(apiBaseUrl, id), {
    method: "DELETE"
  });
  const payload = (await response.json()) as ApiResponse<{ id: string } | null>;

  if (!response.ok || !payload.data) {
    throw new Error(payload.msg || "Failed to delete scheduled task");
  }

  return payload.data;
}

export function createScheduledTasksUrl(
  apiBaseUrl: string,
  workspacePath?: string
): string {
  const url = `${normalizeApiBaseUrl(apiBaseUrl)}/api/v1/scheduled-tasks`;
  if (!workspacePath) return url;
  const params = new URLSearchParams({ workspacePath });
  return `${url}?${params.toString()}`;
}

export function createScheduledTaskUrl(apiBaseUrl: string, id: string): string {
  return `${createScheduledTasksUrl(apiBaseUrl)}/${encodeURIComponent(id)}`;
}

async function requestScheduledTaskMutation(
  url: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<ScheduledTask> {
  const response = await fetch(url, init);
  const payload = (await response.json()) as ApiResponse<ScheduledTask | null>;

  if (!response.ok || !payload.data) {
    throw new Error(payload.msg || fallbackMessage);
  }

  return payload.data;
}

function normalizeApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/$/, "");
}
