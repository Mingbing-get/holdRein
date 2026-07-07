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

function createRuntimeContext(): ServerPlugin.RuntimeContext {
  return {
    agentName: "memory-organizer",
    env: { cwd: "/workspace" } as ServerPlugin.RuntimeContext["env"],
    isContinue: false,
    model: {} as ServerPlugin.RuntimeContext["model"],
    prompt: "Organize memory",
    session: {} as ServerPlugin.RuntimeContext["session"],
    taskId: "task-1",
    thinkingLevel: "off"
  };
}
