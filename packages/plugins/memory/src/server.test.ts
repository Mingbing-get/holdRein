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

  it("starts the final memory organizer with the complete transcript", async () => {
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
    expect(continuation?.prompt).toContain(JSON.stringify(messages, null, 2));
    expect(continuation?.prompt).toContain(".hold-rein/memories/index.md");
    expect(continuation?.prompt).toContain("500 lines");
    expect(continuation?.prompt).toContain("conflict");
    expect(continuation?.prompt).toContain("frequently");
    expect(continuation?.prompt).toContain("read_file");
    expect(continuation?.prompt).toContain("write_file");
    expect(continuation?.prompt).toContain("edit_file");
    expect(continuation?.prompt).toContain("delete_file");
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

async function createWorkspace(indexContent?: string): Promise<string> {
  const workspacePath = await mkdtemp(join(tmpdir(), "hold-rein-memory-"));

  if (indexContent !== undefined) {
    const memoryDirectory = join(workspacePath, ".hold-rein", "memories");
    await mkdir(memoryDirectory, { recursive: true });
    await writeFile(join(memoryDirectory, "index.md"), indexContent, "utf8");
  }

  return workspacePath;
}
