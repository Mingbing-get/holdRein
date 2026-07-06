import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ServerPlugin } from "@hold-rein/plugin-server";
import { describe, expect, it } from "vitest";

import serverPlugin from "./server";

describe("memory server plugin", () => {
  it("injects the memory directory and primary index into regular agents", async () => {
    const workspacePath = await createWorkspace("# Primary memory\n\n- Prefer pnpm.\n");

    const contribution = await resolveContribution("main", workspacePath);

    expect(contribution.systemPrompts).toHaveLength(1);
    expect(contribution.systemPrompts?.[0]).toContain(
      ".hold-rein/memories"
    );
    expect(contribution.systemPrompts?.[0]).toContain("# Primary memory");
    expect(contribution.systemPrompts?.[0]).toContain("Prefer pnpm.");
  });

  it("keeps directory guidance when the primary index does not exist", async () => {
    const workspacePath = await createWorkspace();

    const contribution = await resolveContribution("researcher", workspacePath);

    expect(contribution.systemPrompts).toHaveLength(1);
    expect(contribution.systemPrompts?.[0]).toContain(
      ".hold-rein/memories"
    );
    expect(contribution.systemPrompts?.[0]).not.toContain("Primary memory:\n");
  });

  it("does not inject memory context into the memory organizer", async () => {
    const workspacePath = await createWorkspace("Sensitive memory");

    const contribution = await resolveContribution(
      "memory-organizer",
      workspacePath
    );

    expect(contribution.systemPrompts).toEqual([]);
    expect(contribution.onAgentEnd).toBeUndefined();
  });

  it("does not organize memory when a non-main agent ends", async () => {
    const workspacePath = await createWorkspace();

    const contribution = await resolveContribution("researcher", workspacePath);

    expect(contribution.onAgentEnd).toBeUndefined();
    expect(contribution.agentEndPriority).toBeUndefined();
  });

  it("starts the final memory organizer with the complete transcript when memory has not run", async () => {
    const workspacePath = await createWorkspace();
    const contribution = await resolveContribution("main", workspacePath);
    const messages = [
      { content: "Always use compact tables", role: "user" },
      {
        content: [{ text: "I will remember that.", type: "text" }],
        role: "assistant"
      }
    ] as unknown as ServerPlugin.AgentEndInput["messages"];

    const continuation = await contribution.onAgentEnd?.(
      createAgentEndInput(workspacePath, messages)
    );

    expect(contribution.agentEndPriority).toBe(-9999);
    expect(continuation).toMatchObject({
      agentName: "memory-organizer",
      useSubagent: true
    });
    expect(continuation?.prompt).toContain(
      JSON.stringify(simplifyExpectedMessages(messages), null, 2)
    );
    expect(continuation?.prompt).toContain(".hold-rein/memories/index.md");
    expect(continuation?.prompt).toContain("500 lines");
    expect(continuation?.prompt).toContain("conflict");
    expect(continuation?.prompt).toContain("frequently");
    expect(continuation?.prompt).toContain("read_file");
    expect(continuation?.prompt).toContain("write_file");
    expect(continuation?.prompt).toContain("edit_file");
    expect(continuation?.prompt).toContain("delete_file");
  });

  it("only sends messages after the latest memory organizer run", async () => {
    const workspacePath = await createWorkspace();
    const contribution = await resolveContribution("main", workspacePath);
    const previousMessages = [
      { content: "Remember the old dashboard constraint", role: "user" },
      createMemoryOrganizerMessage("memory-start-1", "Memory organizer is running."),
      createMemoryOrganizerMessage("memory-result-1", "Updated memory files.")
    ];
    const newMessages = [
      { content: "Prefer concise release notes", role: "user" },
      {
        content: [{ text: "Got it.", type: "text" }],
        role: "assistant"
      }
    ] as unknown as ServerPlugin.AgentEndInput["messages"];
    const messages = [
      ...previousMessages,
      ...newMessages
    ] as unknown as ServerPlugin.AgentEndInput["messages"];

    const continuation = await contribution.onAgentEnd?.(
      createAgentEndInput(workspacePath, messages)
    );

    expect(continuation).toMatchObject({
      agentName: "memory-organizer",
      useSubagent: true
    });
    expect(continuation?.prompt).toContain(
      JSON.stringify(simplifyExpectedMessages(newMessages), null, 2)
    );
    expect(continuation?.prompt).toContain("Prefer concise release notes");
    expect(continuation?.prompt).not.toContain("Remember the old dashboard constraint");
  });

  it("sends only memory-relevant fields to the organizer prompt", async () => {
    const workspacePath = await createWorkspace();
    const contribution = await resolveContribution("main", workspacePath);
    const messages = [
      {
        content: "Keep user content",
        id: "user-1",
        role: "user",
        timestamp: 1
      },
      {
        api: "unused-api",
        content: [
          { text: "Assistant content", type: "text" },
          { arguments: { path: "src/a.ts" }, id: "call-1", name: "read_file", type: "toolCall" }
        ],
        id: "assistant-1",
        model: "unused-model",
        provider: "unused-provider",
        role: "assistant",
        stopReason: "toolUse",
        timestamp: 2
      },
      {
        content: [{ text: "Tool output", type: "text" }],
        id: "tool-1",
        isError: false,
        role: "toolResult",
        timestamp: 3,
        toolCallId: "call-1",
        toolName: "read_file"
      },
      {
        content: "Custom content",
        customType: "agent_continuation",
        details: { source: "test-plugin" },
        display: true,
        id: "custom-1",
        role: "custom",
        timestamp: 4
      },
      {
        cancelled: false,
        command: "corepack pnpm test",
        excludeFromContext: true,
        exitCode: 0,
        fullOutputPath: "/tmp/output.txt",
        id: "bash-1",
        output: "Test output",
        role: "bashExecution",
        timestamp: 5,
        truncated: false
      },
      {
        fromId: "message-old",
        id: "branch-summary-1",
        role: "branchSummary",
        summary: "Branch summary",
        timestamp: 6
      },
      {
        id: "compaction-summary-1",
        role: "compactionSummary",
        summary: "Compaction summary",
        timestamp: 7,
        tokensBefore: 1000
      }
    ] as unknown as ServerPlugin.AgentEndInput["messages"];
    const expectedMessages = [
      { content: "Keep user content", role: "user" },
      {
        content: [
          { text: "Assistant content", type: "text" },
          { arguments: { path: "src/a.ts" }, id: "call-1", name: "read_file", type: "toolCall" }
        ],
        role: "assistant",
        stopReason: "toolUse"
      },
      {
        content: [{ text: "Tool output", type: "text" }],
        isError: false,
        role: "toolResult",
        toolCallId: "call-1",
        toolName: "read_file"
      },
      {
        content: "Custom content",
        customType: "agent_continuation",
        role: "custom"
      },
      {
        command: "corepack pnpm test",
        exitCode: 0,
        output: "Test output",
        role: "bashExecution",
        truncated: false
      },
      { role: "branchSummary", summary: "Branch summary" },
      { role: "compactionSummary", summary: "Compaction summary" }
    ];

    const continuation = await contribution.onAgentEnd?.(
      createAgentEndInput(workspacePath, messages)
    );
    const transcript = readPromptTranscript(continuation?.prompt);

    expect(transcript).toEqual(expectedMessages);
    expect(continuation?.prompt).not.toContain("unused-api");
    expect(continuation?.prompt).not.toContain("unused-model");
    expect(continuation?.prompt).not.toContain("unused-provider");
    expect(continuation?.prompt).not.toContain("source");
    expect(continuation?.prompt).not.toContain("fullOutputPath");
    expect(continuation?.prompt).not.toContain("tokensBefore");
    expect(continuation?.prompt).not.toContain("timestamp");
  });

  it("does not start memory organizer when no non-empty user message follows the latest memory run", async () => {
    const workspacePath = await createWorkspace();
    const contribution = await resolveContribution("main", workspacePath);
    const messages = [
      createMemoryOrganizerMessage("memory-start-1", "Memory organizer is running."),
      createMemoryOrganizerMessage("memory-result-1", "Updated memory files."),
      {
        content: [{ text: "Summary of memory work.", type: "text" }],
        role: "assistant"
      },
      { content: "   ", role: "user" }
    ] as unknown as ServerPlugin.AgentEndInput["messages"];

    const continuation = await contribution.onAgentEnd?.(
      createAgentEndInput(workspacePath, messages)
    );

    expect(continuation).toBeUndefined();
  });
});

async function resolveContribution(
  agentName: string,
  workspacePath: string
): Promise<ServerPlugin.Contribution> {
  const resolver = serverPlugin.contributionResolver;
  expect(typeof resolver).toBe("function");

  if (typeof resolver !== "function") {
    throw new TypeError("Expected a contribution resolver function");
  }

  return resolver(createRuntimeContext(agentName, workspacePath));
}

function createRuntimeContext(
  agentName: string,
  workspacePath: string
): ServerPlugin.RuntimeContext {
  return {
    agentName,
    env: { cwd: workspacePath } as ServerPlugin.RuntimeContext["env"],
    isContinue: false,
    model: {} as ServerPlugin.RuntimeContext["model"],
    prompt: "Original task",
    session: {} as ServerPlugin.RuntimeContext["session"],
    taskId: "task-1",
    thinkingLevel: "off"
  };
}

function createAgentEndInput(
  workspacePath: string,
  messages: ServerPlugin.AgentEndInput["messages"]
): ServerPlugin.AgentEndInput {
  return {
    messages,
    runInput: {
      modelId: "test-model",
      prompt: "Original task",
      provider: "test-provider",
      taskId: "task-1",
      workspacePath
    },
    session: {
      createdAt: "2026-07-03T00:00:00.000Z",
      id: "session-1",
      path: join(workspacePath, "session.jsonl")
    }
  };
}

function createMemoryOrganizerMessage(
  id: string,
  content: string
): unknown {
  return {
    content,
    customType: "subagent_result",
    details: { agentName: "memory-organizer" },
    display: true,
    id,
    role: "custom",
    timestamp: Date.now()
  };
}

function simplifyExpectedMessages(
  messages: readonly unknown[]
): readonly unknown[] {
  return messages.map((message) => {
    if (!isRecord(message)) {
      return message;
    }

    if (message.role === "user") {
      return { content: message.content, role: "user" };
    }

    if (message.role === "assistant") {
      return {
        content: message.content,
        role: "assistant",
        stopReason: message.stopReason
      };
    }

    return message;
  });
}

function readPromptTranscript(prompt: string | undefined): unknown {
  if (!prompt) {
    return undefined;
  }

  const marker = "Complete conversation transcript (JSON):\n";
  const markerIndex = prompt.indexOf(marker);
  expect(markerIndex).toBeGreaterThanOrEqual(0);
  return JSON.parse(prompt.slice(markerIndex + marker.length)) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function createWorkspace(indexContent?: string): Promise<string> {
  const workspacePath = await mkdtemp(join(tmpdir(), "hold-rein-memory-"));

  if (indexContent !== undefined) {
    const memoryDirectory = join(workspacePath, ".hold-rein", "memories");
    await mkdir(memoryDirectory, { recursive: true });
    await writeFile(join(memoryDirectory, "index.md"), indexContent, "utf8");
  }

  return workspacePath;
}
