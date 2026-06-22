import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

import tsStandardsServerPlugin, {
  createValidationPrompt,
  detectTsProject,
  extractChangedFilesFromMessages
} from "./index";
import type { ServerPlugin } from "@hold-rein/plugin-server";

describe("tsStandardsServerPlugin", () => {
  it("injects planning and standards skill dirs for TS projects", async () => {
    const workspacePath = await createWorkspace({
      "package.json": JSON.stringify({
        scripts: { test: "vitest run" },
        devDependencies: { typescript: "5.8.3" }
      }),
      "tsconfig.json": "{}"
    });

    const contribution = await resolveContribution(workspacePath, "Build a form");

    expect(contribution.skillDirs).toEqual([
      expect.stringContaining("skills/planning"),
      expect.stringContaining("skills/ts-standards")
    ]);
    expect(contribution.systemPrompts?.join("\n")).toContain(
      "Use the planning skill"
    );
  });

  it("injects only planning skill dirs for non TS projects", async () => {
    const workspacePath = await createWorkspace({
      "README.md": "plain docs"
    });

    const contribution = await resolveContribution(workspacePath, "Edit docs");

    expect(contribution.skillDirs).toEqual([
      expect.stringContaining("skills/planning")
    ]);
  });

  it("extracts successful file changes from tool messages", () => {
    const messages = [
      assistantToolCall("call-write", "write_file", {
        path: "src/new.ts",
        content: "export const value = 1;"
      }),
      toolResult("call-write", "write_file", false, {
        path: "/workspace/src/new.ts"
      }),
      assistantToolCall("call-edit", "edit_file", {
        path: "src/existing.ts",
        oldText: "a",
        newText: "b"
      }),
      toolResult("call-edit", "edit_file", false, {
        path: "/workspace/src/existing.ts"
      }),
      assistantToolCall("call-delete", "delete_file", {
        path: "src/old.ts"
      }),
      toolResult("call-delete", "delete_file", true, {
        path: "/workspace/src/old.ts"
      })
    ] as ServerPlugin.AgentEndInput["messages"];

    expect(extractChangedFilesFromMessages(messages)).toEqual([
      {
        absolutePath: "/workspace/src/new.ts",
        operation: "write",
        path: "src/new.ts",
        toolCallId: "call-write"
      },
      {
        absolutePath: "/workspace/src/existing.ts",
        operation: "edit",
        path: "src/existing.ts",
        toolCallId: "call-edit"
      }
    ]);
  });

  it("starts an independent validator subagent when code changed", async () => {
    const workspacePath = await createWorkspace({
      "AGENTS.md": "Run tests and keep files below 500 lines.",
      "package.json": JSON.stringify({
        scripts: { test: "vitest run", typecheck: "tsc --noEmit" },
        devDependencies: { typescript: "5.8.3" }
      })
    });
    const contribution = await resolveContribution(
      workspacePath,
      "Add a health endpoint"
    );

    const continuation = await contribution.onAgentEnd?.({
      messages: [
        assistantToolCall("call-edit", "edit_file", {
          path: "apps/api/src/health.ts",
          oldText: "old",
          newText: "new"
        }),
        toolResult("call-edit", "edit_file", false, {
          path: join(workspacePath, "apps/api/src/health.ts")
        })
      ] as ServerPlugin.AgentEndInput["messages"],
      runInput: {
        modelId: "gpt-5",
        prompt: "Add a health endpoint",
        provider: "openai",
        taskId: "task-1",
        workspacePath
      },
      session: {
        createdAt: "now",
        id: "session-1",
        path: "/sessions/session-1.jsonl"
      }
    });

    expect(continuation).toMatchObject({ useSubagent: true });
    expect(continuation?.prompt).toContain("Original task");
    expect(continuation?.prompt).toContain("Add a health endpoint");
    expect(continuation?.prompt).toContain("apps/api/src/health.ts");
    expect(continuation?.prompt).toContain("Run the relevant test command");
    expect(continuation?.prompt).toContain("AGENTS.md");
    expect(continuation?.prompt).toContain("Do not rely on the implementing agent");
    expect(continuation?.prompt).not.toContain(`Workspace: ${workspacePath}`);
  });

  it("does not start a validator for validation-only agents", async () => {
    const workspacePath = await createWorkspace({
      "package.json": JSON.stringify({
        devDependencies: { typescript: "5.8.3" }
      })
    });
    const contribution = await resolveContribution(
      workspacePath,
      "[ts-standards-validator]\nValidate this task."
    );

    const continuation = await contribution.onAgentEnd?.({
      messages: [
        assistantToolCall("call-edit", "edit_file", {
          path: "src/file.ts",
          oldText: "old",
          newText: "new"
        }),
        toolResult("call-edit", "edit_file", false, {
          path: join(workspacePath, "src/file.ts")
        })
      ] as ServerPlugin.AgentEndInput["messages"],
      runInput: {
        modelId: "gpt-5",
        prompt: "[ts-standards-validator]\nValidate this task.",
        provider: "openai",
        taskId: "task-1",
        workspacePath
      },
      session: {
        createdAt: "now",
        id: "session-1",
        path: "/sessions/session-1.jsonl"
      }
    });

    expect(continuation).toBeUndefined();
  });

  it("does not revalidate unchanged files after a validator result", async () => {
    const workspacePath = await createWorkspace({
      "package.json": JSON.stringify({
        devDependencies: { typescript: "5.8.3" }
      })
    });
    const contribution = await resolveContribution(workspacePath, "Fix lint");

    const continuation = await contribution.onAgentEnd?.({
      messages: [
        assistantToolCall("call-edit", "edit_file", {
          path: "src/file.ts",
          oldText: "old",
          newText: "new"
        }),
        toolResult("call-edit", "edit_file", false, {
          path: join(workspacePath, "src/file.ts")
        }),
        {
          content:
            "[ts-standards-validator]\nStatus: failed\nFix the style issue.",
          role: "custom"
        }
      ] as ServerPlugin.AgentEndInput["messages"],
      runInput: {
        modelId: "gpt-5",
        prompt: "Fix lint",
        provider: "openai",
        taskId: "task-1",
        workspacePath
      },
      session: {
        createdAt: "now",
        id: "session-1",
        path: "/sessions/session-1.jsonl"
      }
    });

    expect(continuation).toBeUndefined();
  });
});

async function resolveContribution(
  workspacePath: string,
  prompt: string
): Promise<ServerPlugin.Contribution> {
  const resolver = tsStandardsServerPlugin.contributionResolver;

  if (typeof resolver !== "function") {
    throw new Error("Expected dynamic contribution resolver");
  }

  return resolver({
    agentName: "worker",
    env: { cwd: workspacePath } as ServerPlugin.RuntimeContext["env"],
    isContinue: false,
    model: {} as ServerPlugin.RuntimeContext["model"],
    prompt,
    session: {} as ServerPlugin.RuntimeContext["session"],
    thinkingLevel: "medium"
  });
}

async function createWorkspace(files: Record<string, string>): Promise<string> {
  const root = join(
    "/private/tmp",
    `ts-standards-server-${Math.random().toString(36).slice(2)}`
  );

  await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      const filePath = join(root, path);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content, "utf8");
    })
  );

  return root;
}

function assistantToolCall(
  id: string,
  name: string,
  args: Record<string, unknown>
): unknown {
  return {
    content: [
      {
        arguments: args,
        id,
        name,
        type: "toolCall"
      }
    ],
    role: "assistant"
  };
}

function toolResult(
  toolCallId: string,
  toolName: string,
  isError: boolean,
  details: unknown
): unknown {
  return {
    content: [
      {
        text: "ok",
        type: "text"
      }
    ],
    details,
    isError,
    role: "toolResult",
    toolCallId,
    toolName
  };
}

describe("detectTsProject", () => {
  it("detects TypeScript projects from common project files", async () => {
    const workspacePath = await createWorkspace({
      "package.json": JSON.stringify({
        dependencies: { react: "19.0.0" }
      }),
      "vite.config.ts": "export default {};"
    });

    await expect(detectTsProject(workspacePath)).resolves.toEqual({
      detected: true,
      reasons: ["package.json", "vite.config.ts"]
    });
  });
});

describe("createValidationPrompt", () => {
  it("includes the original task and changed files without main context", () => {
    const prompt = createValidationPrompt({
      changedFiles: [
        {
          operation: "edit",
          path: "src/file.ts",
          toolCallId: "call-1"
        }
      ],
      originalPrompt: "Implement search"
    });

    expect(prompt).toContain("[ts-standards-validator]");
    expect(prompt).toContain("Implement search");
    expect(prompt).toContain("edit src/file.ts");
    expect(prompt).toContain("independent validation subagent");
    expect(prompt).not.toContain("conversation history");
    expect(prompt).not.toContain("Workspace:");
  });
});
