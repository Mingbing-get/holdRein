import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../app";
import type { ScheduledAgentTaskRow } from "../../db";
import type { ScheduledTasksService } from "./scheduled-tasks-service";

describe("scheduled task routes", () => {
  it("handles scheduled task CRUD and enablement routes", async () => {
    const task = createScheduledTask();
    const service = createService({
      createScheduledTask: vi.fn().mockReturnValue(task),
      deleteScheduledTask: vi.fn().mockReturnValue(true),
      disableScheduledTask: vi.fn().mockReturnValue({ ...task, enabled: false }),
      enableScheduledTask: vi.fn().mockReturnValue({ ...task, enabled: true }),
      findScheduledTask: vi.fn().mockReturnValue(task),
      listScheduledTasks: vi.fn().mockReturnValue([task]),
      updateScheduledTask: vi.fn().mockReturnValue({ ...task, name: "Updated" })
    });
    const app = await createApp({ scheduledTasksService: service });

    expect((await request(app).get("/api/v1/scheduled-tasks")).body.data).toEqual([
      task
    ]);
    expect(
      (await request(app).post("/api/v1/scheduled-tasks").send(createBody())).body.data
    ).toEqual(task);
    expect(
      (await request(app).get("/api/v1/scheduled-tasks/scheduled-1")).body.data
    ).toEqual(task);
    expect(
      (
        await request(app)
          .patch("/api/v1/scheduled-tasks/scheduled-1")
          .send({ name: "Updated" })
      ).body.data
    ).toEqual({ ...task, name: "Updated" });
    expect(
      (await request(app).post("/api/v1/scheduled-tasks/scheduled-1/disable")).body
        .data
    ).toEqual({ ...task, enabled: false });
    expect(
      (await request(app).post("/api/v1/scheduled-tasks/scheduled-1/enable")).body
        .data
    ).toEqual({ ...task, enabled: true });
    expect(
      (await request(app).delete("/api/v1/scheduled-tasks/scheduled-1")).body.data
    ).toEqual({ id: "scheduled-1" });
  });

  it("passes workspace query filters when listing scheduled tasks", async () => {
    const task = createScheduledTask({ workspacePath: "/tmp/workspace-a" });
    const service = createService({
      listScheduledTasks: vi.fn().mockReturnValue([task])
    });
    const app = await createApp({ scheduledTasksService: service });

    const response = await request(app)
      .get("/api/v1/scheduled-tasks")
      .query({ workspace: "/tmp/workspace-a" });

    expect(response.body.data).toEqual([task]);
    expect(service.listScheduledTasks).toHaveBeenCalledWith({
      workspacePath: "/tmp/workspace-a"
    });
  });

  it("rejects bad create requests", async () => {
    const app = await createApp({ scheduledTasksService: createService() });
    const response = await request(app).post("/api/v1/scheduled-tasks").send({
      name: "Missing required fields"
    });

    expect(response.status).toBe(400);
    expect(response.body.data).toBeNull();
  });

  it("returns not found for missing scheduled task ids", async () => {
    const app = await createApp({
      scheduledTasksService: createService({
        deleteScheduledTask: vi.fn().mockReturnValue(false),
        disableScheduledTask: vi.fn().mockReturnValue(undefined),
        enableScheduledTask: vi.fn().mockReturnValue(undefined),
        findScheduledTask: vi.fn().mockReturnValue(undefined),
        updateScheduledTask: vi.fn().mockReturnValue(undefined)
      })
    });

    expect((await request(app).get("/api/v1/scheduled-tasks/missing")).status).toBe(
      404
    );
    expect(
      (await request(app).patch("/api/v1/scheduled-tasks/missing").send({ name: "x" }))
        .status
    ).toBe(404);
    expect(
      (await request(app).post("/api/v1/scheduled-tasks/missing/enable")).status
    ).toBe(404);
    expect(
      (await request(app).post("/api/v1/scheduled-tasks/missing/disable")).status
    ).toBe(404);
    expect(
      (await request(app).delete("/api/v1/scheduled-tasks/missing")).status
    ).toBe(404);
  });
});

function createService(
  overrides: Partial<ScheduledTasksService> = {}
): ScheduledTasksService {
  return {
    createScheduledTask: vi.fn().mockReturnValue(createScheduledTask()),
    deleteScheduledTask: vi.fn().mockReturnValue(true),
    disableScheduledTask: vi.fn().mockReturnValue(createScheduledTask()),
    enableScheduledTask: vi.fn().mockReturnValue(createScheduledTask()),
    findScheduledTask: vi.fn().mockReturnValue(createScheduledTask()),
    listScheduledTasks: vi.fn().mockReturnValue([createScheduledTask()]),
    updateScheduledTask: vi.fn().mockReturnValue(createScheduledTask()),
    ...overrides
  };
}

function createBody() {
  return {
    allowConcurrentRuns: false,
    cronExpression: "*/5 * * * *",
    modelId: "gpt-4.1",
    name: "Every five minutes",
    prompt: "Run scheduled check",
    provider: "openai",
    thinkingLevel: "medium" as const,
    timezone: "Asia/Shanghai",
    workspacePath: "/tmp/workspace"
  };
}

function createScheduledTask(
  input: Partial<ScheduledAgentTaskRow> = {}
): ScheduledAgentTaskRow {
  return {
    ...createBody(),
    createdAt: "2026-07-02T00:00:00.000Z",
    enabled: true,
    id: "scheduled-1",
    lastRunAt: null,
    nextRunAt: "2026-07-02T00:05:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
    ...input
  };
}
