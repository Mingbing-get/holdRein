import {
  access,
  mkdir,
  mkdtemp,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { TaskRow, WorkspaceRow } from "../../db";
import { createActiveTaskRunRegistry } from "../agents/task/active-run-registry";
import { createInMemoryWorkspaceRepository } from "./workspace-repository";
import { createWorkspacesService } from "./workspaces-service";

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryPaths.splice(0).map((path) => rm(path, { force: true, recursive: true }))
  );
});

describe("workspaces service deletion", () => {
  it("deletes session files, tasks, and the workspace without deleting its project directory", async () => {
    const rootPath = await createTemporaryPath();
    const projectPath = join(rootPath, "project");
    const sessionPath = join(rootPath, "sessions", "session-one.jsonl");
    await mkdir(projectPath);
    await mkdir(join(rootPath, "sessions"));
    await writeFile(sessionPath, "{}");
    const repository = createRepository({
      projectPath,
      tasks: [createTask({ sessionPath })]
    });
    const service = createWorkspacesService({ repository });

    await expect(service.deleteWorkspace("workspace-one")).resolves.toEqual({
      status: "deleted",
      workspaceId: "workspace-one"
    });

    expect(repository.findWorkspaceById("workspace-one")).toBeUndefined();
    expect(repository.findTaskById("task-one")).toBeUndefined();
    await expect(access(sessionPath)).rejects.toThrow();
    await expect(access(projectPath)).resolves.toBeUndefined();
  });

  it("allows a missing task session file", async () => {
    const rootPath = await createTemporaryPath();
    const repository = createRepository({
      projectPath: join(rootPath, "project"),
      tasks: [
        createTask({ sessionPath: join(rootPath, "missing-session.jsonl") })
      ]
    });
    const service = createWorkspacesService({ repository });

    await expect(service.deleteWorkspace("workspace-one")).resolves.toEqual({
      status: "deleted",
      workspaceId: "workspace-one"
    });
  });

  it("keeps database records when a session file cannot be deleted", async () => {
    const rootPath = await createTemporaryPath();
    const sessionDirectory = join(rootPath, "session-directory");
    await mkdir(sessionDirectory);
    const repository = createRepository({
      projectPath: join(rootPath, "project"),
      tasks: [createTask({ sessionPath: sessionDirectory })]
    });
    const service = createWorkspacesService({ repository });

    await expect(service.deleteWorkspace("workspace-one")).rejects.toThrow();

    expect(repository.findWorkspaceById("workspace-one")).toBeDefined();
    expect(repository.findTaskById("task-one")).toBeDefined();
  });

  it("refuses deletion when any workspace task is running", async () => {
    const repository = createRepository({
      projectPath: "/project",
      tasks: [createTask({ status: "running" })]
    });
    const service = createWorkspacesService({ repository });

    await expect(service.deleteWorkspace("workspace-one")).resolves.toEqual({
      status: "has_running_tasks",
      workspaceId: "workspace-one"
    });

    expect(repository.findWorkspaceById("workspace-one")).toBeDefined();
    expect(repository.findTaskById("task-one")).toBeDefined();
  });

  it("reports an unknown workspace", async () => {
    const repository = createInMemoryWorkspaceRepository();
    const service = createWorkspacesService({ repository });

    await expect(service.deleteWorkspace("missing")).resolves.toEqual({
      status: "not_found",
      workspaceId: "missing"
    });
  });
});

describe("workspaces service navigation", () => {
  it("includes the active agent id for a running task", () => {
    const repository = createRepository({
      projectPath: "/project",
      tasks: [createTask({ status: "running" })]
    });
    const activeTaskRuns = createActiveTaskRunRegistry();
    activeTaskRuns.register("task-one", "agent-one");
    const service = createWorkspacesService({
      activeTaskRuns,
      now: () => new Date("2026-06-11T01:00:00.000Z"),
      repository
    });

    expect(
      service.listRecentWorkspaceTasks().workspaces[0]?.tasks[0]
    ).toMatchObject({
      activeAgentId: "agent-one",
      id: "task-one",
      status: "running"
    });
  });

  it("marks a stale running task as error when no active agent exists", () => {
    const repository = createRepository({
      projectPath: "/project",
      tasks: [createTask({ status: "running" })]
    });
    const service = createWorkspacesService({
      activeTaskRuns: createActiveTaskRunRegistry(),
      now: () => new Date("2026-06-11T01:00:00.000Z"),
      repository
    });

    expect(
      service.listRecentWorkspaceTasks().workspaces[0]?.tasks[0]
    ).toMatchObject({
      id: "task-one",
      status: "error"
    });
    expect(repository.findTaskById("task-one")?.status).toBe("error");
  });

  it("keeps a task running while its agent is starting", () => {
    const repository = createRepository({
      projectPath: "/project",
      tasks: [createTask({ status: "running" })]
    });
    const activeTaskRuns = createActiveTaskRunRegistry();
    activeTaskRuns.markStarting("task-one");
    const service = createWorkspacesService({
      activeTaskRuns,
      now: () => new Date("2026-06-11T01:00:00.000Z"),
      repository
    });

    expect(
      service.listRecentWorkspaceTasks().workspaces[0]?.tasks[0]
    ).toMatchObject({
      id: "task-one",
      status: "running"
    });
    expect(repository.findTaskById("task-one")?.status).toBe("running");
  });
});

async function createTemporaryPath(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "hold-rein-workspace-delete-"));
  temporaryPaths.push(path);
  return path;
}

function createRepository(input: {
  projectPath: string;
  tasks: TaskRow[];
}) {
  return createInMemoryWorkspaceRepository({
    tasks: input.tasks,
    workspaces: [createWorkspace(input.projectPath)]
  });
}

function createWorkspace(path: string): WorkspaceRow {
  return {
    createdAt: "2026-06-11T00:00:00.000Z",
    id: "workspace-one",
    name: "Workspace One",
    path,
    updatedAt: "2026-06-11T00:00:00.000Z"
  };
}

function createTask(
  input: {
    sessionPath?: string;
    status?: TaskRow["status"];
  } = {}
): TaskRow {
  return {
    createdAt: "2026-06-11T00:00:00.000Z",
    id: "task-one",
    initialUserMessage: "Hello",
    lastContinuedAt: "2026-06-11T00:00:00.000Z",
    lastModelId: "gpt-4.1",
    lastModelName: "gpt-4.1",
    lastModelProvider: "openai",
    lastModelProviderSource: "built_in",
    sessionCreatedAt: input.sessionPath ? "2026-06-11T00:00:00.000Z" : null,
    sessionId: input.sessionPath ? "session-one" : null,
    sessionPath: input.sessionPath ?? null,
    status: input.status ?? "completed",
    title: "Hello",
    updatedAt: "2026-06-11T00:00:00.000Z",
    workspaceId: "workspace-one"
  };
}
