import { describe, expect, it, vi } from "vitest";

import {
  createScheduledTask,
  createScheduledTaskUrl,
  createScheduledTasksUrl,
  deleteScheduledTask,
  fetchScheduledTasks,
  setScheduledTaskEnabled,
  updateScheduledTask
} from "./scheduled-tasks-api";

const fetchMock = vi.fn<typeof fetch>();

vi.stubGlobal("fetch", fetchMock);

describe("scheduled tasks api", () => {
  it("builds scheduled task urls with optional workspace filters", () => {
    expect(createScheduledTasksUrl("http://localhost:4000/")).toBe(
      "http://localhost:4000/api/v1/scheduled-tasks"
    );
    expect(
      createScheduledTasksUrl("http://localhost:4000", "/Users/me/work space")
    ).toBe(
      "http://localhost:4000/api/v1/scheduled-tasks?workspacePath=%2FUsers%2Fme%2Fwork+space"
    );
    expect(createScheduledTaskUrl("http://localhost:4000", "scheduled 1")).toBe(
      "http://localhost:4000/api/v1/scheduled-tasks/scheduled%201"
    );
  });

  it("loads and mutates scheduled tasks", async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: [createTaskFixture()],
          msg: "ok"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({ code: 0, data: createTaskFixture(), msg: "ok" }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: createTaskFixture({ enabled: false }),
          msg: "ok"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({ code: 0, data: createTaskFixture(), msg: "ok" }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({ code: 0, data: { id: "scheduled-1" }, msg: "ok" }),
        ok: true
      } as Response);

    await expect(
      fetchScheduledTasks("http://localhost:4000", "/workspace")
    ).resolves.toEqual([expect.objectContaining({ id: "scheduled-1" })]);
    await createScheduledTask("http://localhost:4000", createInput());
    await setScheduledTaskEnabled("http://localhost:4000", "scheduled-1", false);
    await updateScheduledTask("http://localhost:4000", "scheduled-1", {
      name: "Updated schedule"
    });
    await deleteScheduledTask("http://localhost:4000", "scheduled-1");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:4000/api/v1/scheduled-tasks?workspacePath=%2Fworkspace"
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4000/api/v1/scheduled-tasks",
      {
        body: JSON.stringify(createInput()),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      }
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:4000/api/v1/scheduled-tasks/scheduled-1/disable",
      { method: "POST" }
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:4000/api/v1/scheduled-tasks/scheduled-1",
      {
        body: JSON.stringify({ name: "Updated schedule" }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH"
      }
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "http://localhost:4000/api/v1/scheduled-tasks/scheduled-1",
      { method: "DELETE" }
    );
  });
});

function createInput() {
  return {
    allowConcurrentRuns: false,
    cronExpression: "*/5 * * * *",
    modelId: "gpt-4.1",
    name: "Every five minutes",
    prompt: "Run scheduled check",
    provider: "openai",
    thinkingLevel: "medium" as const,
    timezone: "Asia/Shanghai",
    workspacePath: "/workspace"
  };
}

function createTaskFixture(
  input: Partial<ReturnType<typeof createInput> & { enabled: boolean }> = {}
) {
  return {
    ...createInput(),
    createdAt: "2026-07-02T00:00:00.000Z",
    enabled: true,
    id: "scheduled-1",
    lastRunAt: null,
    nextRunAt: "2026-07-02T00:05:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
    ...input
  };
}
