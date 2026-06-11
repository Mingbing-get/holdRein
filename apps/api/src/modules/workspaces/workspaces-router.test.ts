import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../app";
import {
  createInMemoryWorkspaceRepository,
  createWorkspacesService
} from "./index";

const NOW = new Date("2026-06-08T12:00:00.000Z");

function createTestApp() {
  const repository = createInMemoryWorkspaceRepository({
    tasks: [
      createTask({
        id: "task-recent-1",
        lastContinuedAt: "2026-06-08T08:00:00.000Z",
        status: "running",
        title: "今天继续的任务",
        workspaceId: "workspace-alpha"
      }),
      createTask({
        id: "task-recent-2",
        lastContinuedAt: "2026-06-07T08:00:00.000Z",
        title: "昨天继续的任务",
        workspaceId: "workspace-alpha"
      }),
      createTask({
        id: "task-older",
        lastContinuedAt: "2026-05-30T08:00:00.000Z",
        title: "更早的任务",
        workspaceId: "workspace-alpha"
      }),
      createTask({
        id: "task-beta-recent",
        lastContinuedAt: "2026-06-06T08:00:00.000Z",
        title: "Beta 最近任务",
        workspaceId: "workspace-beta"
      }),
      createTask({
        id: "task-without-continued-time",
        lastContinuedAt: null,
        title: "没有继续时间的任务",
        workspaceId: "workspace-beta"
      })
    ],
    workspaces: [
      {
        createdAt: "2026-06-01T00:00:00.000Z",
        id: "workspace-alpha",
        name: "Alpha Workspace",
        path: "/tmp/alpha",
        updatedAt: "2026-06-08T00:00:00.000Z"
      },
      {
        createdAt: "2026-06-01T00:00:00.000Z",
        id: "workspace-beta",
        name: "Beta Workspace",
        path: "/tmp/beta",
        updatedAt: "2026-06-08T00:00:00.000Z"
      }
    ]
  });

  return createApp({
    workspacesService: createWorkspacesService({ now: () => NOW, repository })
  });
}

describe("workspace routes", () => {
  it("lists every workspace with tasks continued in the last seven days", async () => {
    const response = await request(createTestApp()).get(
      "/api/v1/workspaces/recent-tasks"
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 0,
      msg: "ok",
      data: {
        workspaces: [
          {
            hasMore: true,
            id: "workspace-alpha",
            name: "Alpha Workspace",
            path: "/tmp/alpha",
            tasks: [
              expect.objectContaining({
                id: "task-recent-1",
                lastContinuedAt: "2026-06-08T08:00:00.000Z",
                status: "running",
                title: "今天继续的任务"
              }),
              expect.objectContaining({
                id: "task-recent-2",
                lastContinuedAt: "2026-06-07T08:00:00.000Z",
                status: "completed",
                title: "昨天继续的任务"
              })
            ]
          },
          {
            hasMore: false,
            id: "workspace-beta",
            name: "Beta Workspace",
            path: "/tmp/beta",
            tasks: [
              expect.objectContaining({
                id: "task-beta-recent",
                lastContinuedAt: "2026-06-06T08:00:00.000Z",
                status: "completed",
                title: "Beta 最近任务"
              })
            ]
          }
        ]
      }
    });
  });

  it("lists the next page for one workspace after a lastContinuedAt cursor", async () => {
    const response = await request(createTestApp()).get(
      "/api/v1/workspaces/workspace-alpha/tasks?afterLastContinuedAt=2026-06-08T08%3A00%3A00.000Z&limit=1"
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 0,
      msg: "ok",
      data: {
        hasMore: true,
        tasks: [
          expect.objectContaining({
            id: "task-recent-2",
            lastContinuedAt: "2026-06-07T08:00:00.000Z",
            status: "completed"
          })
        ],
        workspaceId: "workspace-alpha"
      }
    });
  });

  it("rejects invalid workspace task pagination query values", async () => {
    const response = await request(createTestApp()).get(
      "/api/v1/workspaces/workspace-alpha/tasks?afterLastContinuedAt=not-a-date&limit=0"
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: 40000,
      msg: "afterLastContinuedAt must be an ISO date string",
      data: null
    });
  });
});

function createTask(input: {
  id: string;
  lastContinuedAt: string | null;
  status?: "running" | "completed" | "error";
  title: string;
  workspaceId: string;
}) {
  return {
    createdAt: "2026-06-01T00:00:00.000Z",
    id: input.id,
    initialUserMessage: input.title,
    lastContinuedAt: input.lastContinuedAt,
    lastModelId: "gpt-4.1",
    lastModelName: "gpt-4.1",
    lastModelProvider: "openai",
    lastModelProviderSource: "built_in" as const,
    sessionCreatedAt: null,
    sessionId: null,
    sessionPath: null,
    status: input.status ?? "completed",
    title: input.title,
    updatedAt: "2026-06-08T00:00:00.000Z",
    workspaceId: input.workspaceId
  };
}
