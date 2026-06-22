import { Type } from "@earendil-works/pi-ai";
import type { ServerPlugin } from "@hold-rein/plugin-server";
import { describe, expect, it, vi } from "vitest";

import { createInMemoryWorkspaceRepository } from "../workspaces";
import { createAgentApprovalStore } from "./approval/store";
import { createAgentEventBus } from "./event/event-bus";
import { createAgentsService } from "./service";
import { createAgentRuntime } from "./runtime";
import { createInMemorySubagentRepository } from "./subagent/repository";
import { createContribution, createRunInput, createSessionRepo } from "./runtime/test-utils";
import { runToolBeforeExecute } from "./approval/tool-approval";

const prompt = vi.fn().mockResolvedValue(undefined);
const harnessConstructor = vi.fn();
const harnessOn = vi.fn();
const resolveContributions = vi.hoisted(() => vi.fn());

vi.mock("@earendil-works/pi-agent-core/node", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();

  return {
    ...original,
    AgentHarness: class {
      on = harnessOn;
      prompt = prompt;
      subscribe = vi.fn();

      constructor(options: unknown) {
        harnessConstructor(options);
      }
    },
    NodeExecutionEnv: class {
      constructor(readonly options: unknown) {}
    },
    loadSkills: vi.fn().mockResolvedValue({ diagnostics: [], skills: [] })
  };
});

vi.mock("../../../plugin", () => ({
  pluginRegistry: {
    resolveContributions
  }
}));

describe("agent task options", () => {
  it("stores thinking level and approval policy on new tasks and passes them to runtime", async () => {
    const repository = createInMemoryWorkspaceRepository();
    const runtime = {
      interrupt: vi.fn(),
      listMessages: vi.fn(),
      start: vi.fn().mockResolvedValue({
        agentId: "agent-1",
        session: {
          createdAt: "2026-06-22T00:00:00.000Z",
          id: "session-1",
          path: "/sessions/session-1.jsonl"
        },
        status: "running"
      })
    };
    const service = createAgentsService({
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      now: () => new Date("2026-06-22T00:00:00.000Z"),
      repository,
      runtime,
      titleGenerator: { generateTitle: vi.fn().mockResolvedValue("Task") }
    });

    const result = await service.startAgent({
      approvalPolicy: "run_all",
      modelId: "gpt-4.1",
      prompt: "Inspect",
      provider: "openai",
      thinkingLevel: "high",
      workspacePath: "/tmp/workspace"
    });

    expect(result.task).toEqual(
      expect.objectContaining({
        approvalPolicy: "run_all",
        thinkingLevel: "high"
      })
    );
    expect(runtime.start).toHaveBeenCalledWith(
      expect.objectContaining({
        approvalPolicy: "run_all",
        thinkingLevel: "high"
      })
    );
  });

  it("updates task options when continuing a task", async () => {
    const repository = createInMemoryWorkspaceRepository({
      tasks: [
        {
          approvalPolicy: "approval",
          createdAt: "now",
          id: "task-1",
          initialUserMessage: "Initial",
          lastContinuedAt: "now",
          lastModelId: "gpt-4.1",
          lastModelName: "gpt-4.1",
          lastModelProvider: "openai",
          lastModelProviderSource: "built_in",
          sessionCreatedAt: null,
          sessionId: null,
          sessionPath: null,
          status: "completed",
          thinkingLevel: "medium",
          title: "Task",
          updatedAt: "now",
          workspaceId: "workspace-1"
        }
      ],
      workspaces: [
        {
          createdAt: "now",
          id: "workspace-1",
          name: "workspace",
          path: "/tmp/workspace",
          updatedAt: "now"
        }
      ]
    });
    const runtime = {
      interrupt: vi.fn(),
      listMessages: vi.fn(),
      start: vi.fn().mockResolvedValue({
        agentId: "agent-2",
        session: {
          createdAt: "2026-06-22T00:00:00.000Z",
          id: "session-2",
          path: "/sessions/session-2.jsonl"
        },
        status: "running"
      })
    };
    const service = createAgentsService({
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      now: () => new Date("2026-06-22T00:00:00.000Z"),
      repository,
      runtime,
      titleGenerator: { generateTitle: vi.fn() }
    });

    await service.continueTask({
      approvalPolicy: "run_all",
      prompt: "Continue",
      taskId: "task-1",
      thinkingLevel: "low"
    });

    expect(runtime.start).toHaveBeenCalledWith(
      expect.objectContaining({
        approvalPolicy: "run_all",
        thinkingLevel: "low"
      })
    );
    expect(repository.findTaskById("task-1")).toEqual(
      expect.objectContaining({
        approvalPolicy: "run_all",
        thinkingLevel: "low"
      })
    );
  });

  it("passes thinking level to harness", async () => {
    const approvalStore = createAgentApprovalStore();
    const eventBus = createAgentEventBus();
    const { repo } = createSessionRepo();
    const runtime = createAgentRuntime({
      approvalStore,
      eventBus,
      sessionRepo: repo,
      subagentRepository: createInMemorySubagentRepository()
    });
    const approvalEvents: unknown[] = [];

    const result = await runtime.start({
      ...createRunInput(),
      approvalPolicy: "run_all",
      thinkingLevel: "xhigh"
    });
    expect(harnessConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ thinkingLevel: "xhigh" })
    );
    expect(result.status).toBe("running");
  });

  it("auto-approves tool approval requests for run_all", async () => {
    const approvalStore = createAgentApprovalStore();
    const eventBus = createAgentEventBus();
    const approvalEvents: unknown[] = [];

    eventBus.subscribe({ agentId: "agent-1" }, (event) => {
      if (event.type === "approval_requested") {
        approvalEvents.push(event);
      }
    });

    await expect(
      runToolBeforeExecute({
        agentId: "agent-1",
        approvalPolicy: "run_all",
        approvalStore,
        event: {
          input: { file: "src/index.ts" },
          type: "tool_call",
          toolCallId: "tool-call-1",
          toolName: "workspace_patch"
        },
        eventBus,
        tool: {
          execute: vi.fn(),
          description: "Apply a workspace patch",
          label: "Workspace Patch",
          name: "workspace_patch",
          parameters: Type.Object({}),
          beforeExecute: ({
            requestApproval
          }: ServerPlugin.ToolBeforeExecuteOptions) =>
            requestApproval("允许插件修改工作区？")
        },
        workspacePath: "/tmp/workspace"
      })
    ).resolves.toBeUndefined();
    expect(approvalEvents).toEqual([]);
  });
});
