import type {
  JsonlSessionMetadata,
  JsonlSessionRepoApi,
  Session
} from "@earendil-works/pi-agent-core";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ServerPlugin } from "@hold-rein/plugin-server";
import { vi } from "vitest";

import type { AppDatabase } from "../../../db";
import type { SkillsService } from "../../skills";
import type { TokenUsageStorageTarget } from "./token-collection";
import { createAgentApprovalStore } from "../approval/store";
import { createAgentEventBus } from "../event/event-bus";
import { createAgentRuntime } from ".";
import {
  createInMemorySubagentRepository,
  type SubagentRepository
} from "../subagent/repository";

export function createRunInput() {
  return {
    approvalPolicy: "approval" as const,
    modelId: "gpt-4.1",
    prompt: "Continue",
    provider: "openai",
    thinkingLevel: "medium" as const,
    taskId: "task-1",
    workspacePath: "/tmp/workspace"
  };
}

export function createContribution(
  overrides: ServerPlugin.Contribution = {}
): ServerPlugin.Contribution {
  return { skillDirs: [], skills: [], systemPrompts: [], tools: [], ...overrides };
}

export function subagentInput() {
  return { agentName: "researcher", prompt: "Inspect the auth module" };
}

export function subagentDetails(parentAgentId: string) {
  return { agentName: "researcher", parentAgentId, taskId: "task-1" };
}

export function toolResultMessage(toolCallId: string) {
  return {
    content: [{ text: "Subagent started", type: "text" }],
    role: "toolResult",
    timestamp: 2,
    toolCallId,
    toolName: "call_subagent"
  };
}

export function createSessionRepo() {
  const appendCustomMessageEntry = vi.fn();
  let sessionNumber = 0;
  const createSession = (id: string, metadata?: JsonlSessionMetadata) => ({
    appendCustomMessageEntry,
    buildContext: vi.fn().mockResolvedValue({
      messages: [{ content: `Saved prompt for ${id}`, role: "user", timestamp: 1 }],
      model: null,
      thinkingLevel: "off"
    }),
    getMetadata: vi.fn().mockResolvedValue(metadata ?? {
      createdAt: "2026-06-11T00:00:00.000Z",
      cwd: "/tmp/workspace",
      id,
      path: `/sessions/${id}.jsonl`
    } satisfies JsonlSessionMetadata)
  } as unknown as Session<JsonlSessionMetadata>);
  const create = vi.fn().mockImplementation(async () => {
    sessionNumber += 1;
    return createSession(`session-${sessionNumber}`);
  });
  const open = vi.fn().mockImplementation(async (metadata: JsonlSessionMetadata) =>
    createSession(metadata.id, metadata)
  );
  const repo = {
    create,
    delete: vi.fn(),
    fork: vi.fn(),
    list: vi.fn(),
    open
  } as unknown as JsonlSessionRepoApi;

  return {
    appendCustomMessageEntry,
    create,
    open,
    repo
  };
}

export function getHarnessTool(
  constructor: { mock: { calls: unknown[][] } },
  name: string
) {
  const options = constructor.mock.calls.at(-1)?.[0] as {
    tools?: { execute?: (toolCallId: string, input: unknown) => unknown; name: string }[];
  } | undefined;

  return options?.tools?.find((tool) => tool.name === name);
}

export function createRuntime(
  sessionRepo: JsonlSessionRepoApi,
  eventBus = createAgentEventBus(),
  subagentRepository: SubagentRepository = createInMemorySubagentRepository(),
  subagentDatabase?: AppDatabase,
  tokenUsageOptions?: {
    tokenFlushIntervalMs?: number;
    addModelTokenUsageHourly?: TokenUsageStorageTarget["addModelTokenUsageHourly"];
    addTaskTokenUsage?: TokenUsageStorageTarget["addTaskTokenUsage"];
  },
  runtimeOptions?: {
    skillsService?: SkillsService;
  }
) {
  return createAgentRuntime({
    approvalStore: createAgentApprovalStore(),
    eventBus,
    sessionRepo,
    ...(runtimeOptions?.skillsService === undefined
      ? {}
      : { skillsService: runtimeOptions.skillsService }),
    ...(subagentDatabase === undefined ? {} : { subagentDatabase }),
    subagentRepository,
    tempSkillDir: join(tmpdir(), "hold-rein-test-skills"),
    ...(tokenUsageOptions?.addTaskTokenUsage === undefined ||
    tokenUsageOptions.addModelTokenUsageHourly === undefined
      ? {}
      : {
          tokenUsageStorageTarget: {
            addModelTokenUsageHourly: tokenUsageOptions.addModelTokenUsageHourly,
            addTaskTokenUsage: tokenUsageOptions.addTaskTokenUsage
          }
        }),
    ...(tokenUsageOptions?.tokenFlushIntervalMs === undefined
      ? {}
      : { tokenFlushIntervalMs: tokenUsageOptions.tokenFlushIntervalMs })
  });
}
