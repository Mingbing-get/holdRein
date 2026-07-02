import request from "supertest";
import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createApp } from "../../app";
import {
  createInMemoryWorkspaceRepository,
  createWorkspacesService
} from "./index";

const NOW = new Date("2026-06-08T12:00:00.000Z");

async function createTestApp() {
  const rootDir = await mkdtemp(join(tmpdir(), "hold-rein-workspaces-router-"));
  const alphaPath = join(rootDir, "alpha");
  const betaPath = join(rootDir, "beta");
  const repository = createInMemoryWorkspaceRepository({
    tasks: [
      createTask({
        createdAt: "2026-06-01T00:00:00.000Z",
        id: "task-recent-1",
        lastContinuedAt: "2026-06-08T08:00:00.000Z",
        status: "running",
        title: "今天继续的任务",
        workspaceId: "workspace-alpha"
      }),
      createTask({
        createdAt: "2026-06-02T00:00:00.000Z",
        id: "task-recent-2",
        lastContinuedAt: "2026-06-07T08:00:00.000Z",
        sourceMark: "scheduled-task-one",
        sourceType: "scheduled",
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
        path: alphaPath,
        updatedAt: "2026-06-08T00:00:00.000Z"
      },
      {
        createdAt: "2026-06-02T00:00:00.000Z",
        id: "workspace-beta",
        name: "Beta Workspace",
        path: betaPath,
        updatedAt: "2026-06-08T00:00:00.000Z"
      }
    ]
  });

  return {
    alphaPath,
    app: await createApp({
      workspacesService: createWorkspacesService({
        now: () => NOW,
        pluginsService: {
          installPlugin: async () => {
            throw new Error("not implemented");
          },
          listDisabledPluginIds: async () => [],
          listPlugins: async () => [],
          setPluginDisabled: async () => null,
          uninstallPlugin: async () => false
        },
        repository,
        skillsService: {
          installSkill: async () => {
            throw new Error("not implemented");
          },
          listEnabledSkillDirs: async () => [],
          listSkills: async () => [],
          load: async () => undefined,
          setSkillDisabled: async () => null,
          uninstallSkill: async () => false
        }
      })
    }),
    betaPath,
    rootDir
  };
}

describe("workspace routes", () => {
  it("deletes a workspace and all of its tasks", async () => {
    const { app } = await createTestApp();
    const deleteResponse = await request(app).delete(
      "/api/v1/workspaces/workspace-beta"
    );

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toEqual({
      code: 0,
      msg: "ok",
      data: { workspaceId: "workspace-beta" }
    });

    const navigationResponse = await request(app).get(
      "/api/v1/workspaces/recent-tasks"
    );
    expect(navigationResponse.body.data.workspaces).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "workspace-beta" })
      ])
    );
  });

  it("returns not found when deleting an unknown workspace", async () => {
    const { app } = await createTestApp();
    const response = await request(app).delete(
      "/api/v1/workspaces/missing"
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      code: 40400,
      msg: "Unknown workspace",
      data: null
    });
  });

  it("returns conflict when deleting a workspace with a running task", async () => {
    const { app } = await createTestApp();
    const response = await request(app).delete(
      "/api/v1/workspaces/workspace-alpha"
    );

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      code: 40900,
      msg: "Workspace has running tasks",
      data: null
    });
  });

  it("lists every workspace with tasks continued in the last seven days", async () => {
    const { app, alphaPath, betaPath } = await createTestApp();
    const response = await request(app).get(
      "/api/v1/workspaces/recent-tasks"
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 0,
      msg: "ok",
      data: {
        workspaces: [
          {
            hasMore: false,
            id: "workspace-beta",
            name: "Beta Workspace",
            path: betaPath,
            tasks: [
              expect.objectContaining({
                id: "task-beta-recent",
                lastContinuedAt: "2026-06-06T08:00:00.000Z",
                status: "completed",
                title: "Beta 最近任务"
              })
            ]
          },
          {
            hasMore: true,
            id: "workspace-alpha",
            name: "Alpha Workspace",
            path: alphaPath,
            tasks: [
              expect.objectContaining({
                id: "task-recent-2",
                lastContinuedAt: "2026-06-07T08:00:00.000Z",
                sourceMark: "scheduled-task-one",
                sourceType: "scheduled",
                status: "completed",
                title: "昨天继续的任务"
              }),
              expect.objectContaining({
                id: "task-recent-1",
                lastContinuedAt: "2026-06-08T08:00:00.000Z",
                status: "running",
                title: "今天继续的任务"
              })
            ]
          }
        ]
      }
    });
  });

  it("lists the next page for one workspace after a lastContinuedAt cursor", async () => {
    const { app } = await createTestApp();
    const response = await request(app).get(
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
            sourceMark: "scheduled-task-one",
            sourceType: "scheduled",
            status: "completed"
          })
        ],
        workspaceId: "workspace-alpha"
      }
    });
  });

  it("rejects invalid workspace task pagination query values", async () => {
    const { app } = await createTestApp();
    const response = await request(app).get(
      "/api/v1/workspaces/workspace-alpha/tasks?afterLastContinuedAt=not-a-date&limit=0"
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: 40000,
      msg: "afterLastContinuedAt must be an ISO date string",
      data: null
    });
  });

  it("reads a workspace setting file with plugin and skill options", async () => {
    const { alphaPath, app } = await createTestApp();
    await mkdir(join(alphaPath, ".hold-rein"), { recursive: true });
    await writeFile(
      join(alphaPath, ".hold-rein", "setting.json"),
      `${JSON.stringify({
        activePlugins: ["@hold-rein/base"],
        activeSkills: ["planner"]
      })}\n`,
      "utf8"
    );
    await mkdir(join(alphaPath, ".hold-rein", "skills", "planner"), {
      recursive: true
    });
    await writeFile(
      join(alphaPath, ".hold-rein", "skills", "planner", "SKILL.md"),
      "---\nname: planner\n---\n",
      "utf8"
    );

    const response = await request(app).get(
      "/api/v1/workspaces/workspace-alpha/setting"
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      setting: {
        activePlugins: ["@hold-rein/base"],
        activeSkills: ["planner"]
      },
      skillOptions: [
        {
          id: "planner",
          name: "planner",
          source: "workspace"
        }
      ],
      workspaceId: "workspace-alpha"
    });
  });

  it("updates a workspace setting file and removes global fields", async () => {
    const { alphaPath, app } = await createTestApp();
    await mkdir(join(alphaPath, ".hold-rein"), { recursive: true });
    await writeFile(
      join(alphaPath, ".hold-rein", "setting.json"),
      `${JSON.stringify({
        activePlugins: ["old-plugin"],
        activeSkills: ["old-skill"],
        model: "keep-me"
      })}\n`,
      "utf8"
    );

    const response = await request(app)
      .patch("/api/v1/workspaces/workspace-alpha/setting")
      .send({
        activePlugins: ["@hold-rein/base"],
        activeSkills: null
      });

    expect(response.status).toBe(200);
    expect(response.body.data.setting).toEqual({
      activePlugins: ["@hold-rein/base"]
    });
    await expect(
      readFile(join(alphaPath, ".hold-rein", "setting.json"), "utf8").then(
        (content) => JSON.parse(content) as unknown
      )
    ).resolves.toEqual({
      activePlugins: ["@hold-rein/base"],
      model: "keep-me"
    });
  });
});

function createTask(input: {
  createdAt?: string;
  id: string;
  lastContinuedAt: string | null;
  sourceMark?: string | null;
  sourceType?: "manual" | "scheduled";
  status?: "running" | "completed" | "error";
  title: string;
  workspaceId: string;
}) {
  return {
    createdAt: input.createdAt ?? "2026-06-01T00:00:00.000Z",
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
    sourceMark: input.sourceMark ?? null,
    sourceType: input.sourceType ?? "manual",
    status: input.status ?? "completed",
    title: input.title,
    updatedAt: "2026-06-08T00:00:00.000Z",
    workspaceId: input.workspaceId
  };
}
