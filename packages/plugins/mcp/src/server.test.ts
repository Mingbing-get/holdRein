import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ServerPlugin } from "@hold-rein/plugin-server";
import { describe, expect, it } from "vitest";

import { createCopyServerSkillsPlugin } from "../vite.config";
import serverPlugin from "./server";

describe("mcp server plugin", () => {
  it("contributes the MCP configuration skill directory", async () => {
    const contribution = await resolveContribution();

    expect(contribution.skillDirs).toHaveLength(1);
    expect(contribution.skillDirs?.[0]).toMatch(/skills\/mcp-configuration$/);
  });

  it("copies the MCP configuration skill into the dist skills directory", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "mcp-skill-build-"));
    const outDir = join(tempRoot, "dist");

    try {
      const plugin = createCopyServerSkillsPlugin({
        outDir,
        sourceDir: join(
          process.cwd(),
          "packages/plugins/mcp/src/server/skills"
        )
      });

      await plugin.closeBundle?.();

      await expect(
        readFile(join(outDir, "skills/mcp-configuration/SKILL.md"), "utf8")
      ).resolves.toContain("name: mcp-configuration");
      await expect(
        readFile(join(outDir, "skills/mcp-configuration/SKILL.md"), "utf8")
      ).resolves.toContain("Do not use an API to manage MCP servers");
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });
});

async function resolveContribution(): Promise<ServerPlugin.Contribution> {
  if (!serverPlugin.contributionResolver) {
    throw new Error("Expected a contribution resolver");
  }

  return serverPlugin.contributionResolver({
    agentName: "main",
    env: { cwd: "/workspace" } as ServerPlugin.RuntimeContext["env"],
    isContinue: false,
    model: {} as ServerPlugin.RuntimeContext["model"],
    prompt: "Configure an MCP server",
    session: {} as ServerPlugin.RuntimeContext["session"],
    taskId: "task-1",
    thinkingLevel: "medium" as ServerPlugin.RuntimeContext["thinkingLevel"]
  });
}
