import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { ServerPlugin } from "@hold-rein/plugin-server";
import { describe, expect, it } from "vitest";

import { createCopyServerSkillsPlugin } from "../vite.config";
import serverPlugin from "./server";

describe("ts-standards server plugin", () => {
  it("does not contribute to the memory organizer agent", async () => {
    const resolver = serverPlugin.contributionResolver;
    expect(typeof resolver).toBe("function");

    if (typeof resolver !== "function") {
      throw new TypeError("Expected a contribution resolver function");
    }

    const contribution = await resolver(createRuntimeContext());

    expect(contribution).toEqual({});
  });

  it("validates all work since the first user message after the previous validator", async () => {
    const resolver = serverPlugin.contributionResolver;
    expect(typeof resolver).toBe("function");

    if (typeof resolver !== "function") {
      throw new TypeError("Expected a contribution resolver function");
    }

    const contribution = await resolver(createRuntimeContext("main"));
    const continuation = await contribution.onAgentEnd?.({
      messages: [
        {
          content: "Previous validation",
          details: { agentName: "ts-standards-validator" },
          role: "custom"
        },
        { content: "   ", role: "user" },
        { content: "Implement the original task", role: "user" },
        {
          content: [
            {
              arguments: { path: "src/first.ts" },
              id: "write-first",
              name: "write_file",
              type: "toolCall"
            }
          ],
          role: "assistant"
        },
        {
          content: [],
          isError: false,
          role: "toolResult",
          toolCallId: "write-first",
          toolName: "write_file"
        },
        {
          content: [
            { text: "继续", type: "text" },
            { text: "  ", type: "text" },
            { data: "image", mimeType: "image/png", type: "image" }
          ],
          role: "user"
        },
        {
          content: [
            {
              arguments: { path: "src/second.ts" },
              id: "edit-second",
              name: "edit_file",
              type: "toolCall"
            }
          ],
          role: "assistant"
        },
        {
          content: [],
          isError: false,
          role: "toolResult",
          toolCallId: "edit-second",
          toolName: "edit_file"
        }
      ] as ServerPlugin.AgentEndInput["messages"],
      runInput: {
        modelId: "model",
        prompt: "继续",
        provider: "provider",
        taskId: "task-1",
        workspacePath: process.cwd()
      },
      session: {
        createdAt: "2026-07-09T00:00:00.000Z",
        id: "session-1",
        path: "/tmp/session-1"
      }
    });

    expect(continuation?.agentName).toBe("ts-standards-validator");
    expect(continuation?.prompt).toContain(
      "Original task:\nImplement the original task\n继续\n\nChanged files"
    );
    expect(continuation?.prompt).toContain("- write src/first.ts");
    expect(continuation?.prompt).toContain("- edit src/second.ts");
    expect(await continuation?.pluginFilter?.([
      { id: "__base__plugin" },
      { id: "__code__plugin" },
      { id: "__memory__plugin" }
    ] as ServerPlugin.Plugin[])).toEqual([
      { id: "__base__plugin" },
      { id: "__code__plugin" }
    ]);
  });
});

describe("ts-standards build config", () => {
  it("copies server skills into the dist skills directory", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "ts-standards-build-"));
    const outDir = join(tempRoot, "dist");

    try {
      const plugin = createCopyServerSkillsPlugin({
        sourceDir: join(process.cwd(), "packages/plugins/ts-standards/src/server/skills"),
        outDir
      });

      await plugin.closeBundle?.();

      await expect(
        readFile(join(outDir, "skills/ts-standards/SKILL.md"), "utf8")
      ).resolves.toContain("ts-standards");
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });
});

function createRuntimeContext(
  agentName = "memory-organizer"
): ServerPlugin.RuntimeContext {
  return {
    agentName,
    env: {
      cwd: agentName === "main" ? process.cwd() : "/workspace"
    } as ServerPlugin.RuntimeContext["env"],
    isContinue: false,
    model: {} as ServerPlugin.RuntimeContext["model"],
    prompt: "Organize memory",
    session: {} as ServerPlugin.RuntimeContext["session"],
    taskId: "task-1",
    thinkingLevel: "off"
  };
}
