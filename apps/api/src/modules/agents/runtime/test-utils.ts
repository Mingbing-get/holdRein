import type {
  JsonlSessionMetadata,
  JsonlSessionRepoApi,
  Session
} from "@earendil-works/pi-agent-core";
import type { ServerPlugin } from "@hold-rein/plugin-server";
import { vi } from "vitest";

import { createAgentApprovalStore } from "../approval/store";
import { createAgentEventBus } from "../event/event-bus";
import { createAgentRuntime } from ".";
import {
  createInMemorySubagentRepository,
  type SubagentRepository
} from "../subagent/repository";

export function createRunInput() {
  return {
    modelId: "gpt-4.1",
    prompt: "Continue",
    provider: "openai",
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
  const createSession = (id: string) => ({
    appendCustomMessageEntry,
    buildContext: vi.fn().mockResolvedValue({
      messages: [{ content: `Saved prompt for ${id}`, role: "user", timestamp: 1 }],
      model: null,
      thinkingLevel: "off"
    }),
    getMetadata: vi.fn().mockResolvedValue({
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
  const open = vi.fn().mockResolvedValue(createSession("session-1"));
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
  subagentRepository: SubagentRepository = createInMemorySubagentRepository()
) {
  return createAgentRuntime({
    approvalStore: createAgentApprovalStore(),
    eventBus,
    sessionRepo,
    subagentRepository
  });
}
