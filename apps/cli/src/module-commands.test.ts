import { describe, expect, it } from "vitest";

import { runCli } from "./index";
import type { ScheduledAgentTaskInput, ScheduledTaskRow } from "./types";

const collectOutput = (): {
  readonly lines: string[];
  readonly write: (value: string) => void;
} => {
  const lines: string[] = [];

  return {
    lines,
    write: (value: string): void => {
      lines.push(value);
    }
  };
};

describe("module commands", () => {
  it("creates scheduled tasks through the scheduled task service", async () => {
    const output = collectOutput();
    const createdInputs: ScheduledAgentTaskInput[] = [];

    const result = await runCli(
      [
        "scheduled-task",
        "create",
        "--name",
        "Check",
        "--prompt",
        "Check status",
        "--provider",
        "openai",
        "--model",
        "gpt-4.1",
        "--workspace",
        "/repo",
        "--cron",
        "*/5 * * * *",
        "--timezone",
        "Asia/Shanghai",
        "--thinking",
        "medium",
        "--allow-concurrent"
      ],
      {
        packageVersion: "1.2.3",
        services: {
          scheduledTasks: {
            createScheduledTask: (input) => {
              createdInputs.push(input);
              return createScheduledTaskRow({ ...input, id: "scheduled_1" });
            },
            deleteScheduledTask: () => false,
            disableScheduledTask: () => undefined,
            enableScheduledTask: () => undefined,
            findScheduledTask: () => undefined,
            listScheduledTasks: () => [],
            updateScheduledTask: () => undefined
          }
        },
        write: output.write
      }
    );

    expect(result.exitCode).toBe(0);
    expect(createdInputs).toEqual([
      {
        allowConcurrentRuns: true,
        cronExpression: "*/5 * * * *",
        modelId: "gpt-4.1",
        name: "Check",
        prompt: "Check status",
        provider: "openai",
        thinkingLevel: "medium",
        timezone: "Asia/Shanghai",
        workspacePath: "/repo"
      }
    ]);
    expect(output.lines.join("")).toContain("scheduled_1");
  });

  it("deletes workspaces through the workspace service", async () => {
    const output = collectOutput();
    const deletedWorkspaceIds: string[] = [];

    const result = await runCli(["workspace", "delete", "workspace-1"], {
      packageVersion: "1.2.3",
      services: {
        workspaces: {
          deleteWorkspace: async (workspaceId) => {
            deletedWorkspaceIds.push(workspaceId);
            return { status: "deleted", workspaceId };
          },
          getWorkspaceSetting: async () => undefined,
          listRecentWorkspaceTasks: () => ({ workspaces: [] }),
          listWorkspaceTasksAfter: () => undefined,
          updateWorkspaceSetting: async () => undefined
        }
      },
      write: output.write
    });

    expect(result.exitCode).toBe(0);
    expect(deletedWorkspaceIds).toEqual(["workspace-1"]);
    expect(output.lines).toEqual(["Deleted workspace workspace-1\n"]);
  });
});

function createScheduledTaskRow(
  input: ScheduledAgentTaskInput & { readonly id: string }
): ScheduledTaskRow {
  return {
    ...input,
    createdAt: "2026-07-02T00:00:00.000Z",
    enabled: input.enabled ?? true,
    lastRunAt: null,
    nextRunAt: "2026-07-02T00:05:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z"
  };
}
