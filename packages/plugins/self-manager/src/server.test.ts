import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ServerPlugin } from "@hold-rein/plugin-server";
import { describe, expect, it } from "vitest";

import serverPlugin from "./server";
import { createCopyServerSkillsPlugin } from "../vite.config";
import { BLOCKED_SELF_API_ROUTE_PATTERNS } from "./shared/self-api-catalog";

describe("self-manager server plugin", () => {
  it("injects the self-manager skill directory", async () => {
    const contribution = await resolveContribution();

    expect(contribution.skills).toBeUndefined();
    expect(contribution.skillDirs).toHaveLength(1);
    expect(contribution.skillDirs?.[0]).toMatch(/skills\/self-manager$/);
  });

  it("stores API guidance in module-specific skill references", async () => {
    const contribution = await resolveContribution();
    const skillDir = contribution.skillDirs?.[0];
    if (!skillDir) throw new Error("Expected self-manager skill directory");

    const skillContent = await readFile(join(skillDir, "SKILL.md"), "utf8");
    const agentApi = await readReference(skillDir, "agent-api.md");
    const pluginApi = await readReference(skillDir, "plugin-api.md");
    const modelApi = await readReference(skillDir, "model-api.md");
    const scheduledTaskApi = await readReference(skillDir, "scheduled-task-api.md");
    const workspaceApi = await readReference(skillDir, "workspace-api.md");
    const usageApi = await readReference(skillDir, "usage-api.md");
    const skillApi = await readReference(skillDir, "skill-api.md");
    const allReferences = [
      agentApi,
      pluginApi,
      modelApi,
      scheduledTaskApi,
      workspaceApi,
      usageApi,
      skillApi
    ].join("\n");

    expect(skillContent).toContain("name: self-manager");
    expect(skillContent).toContain("agent, plugin, skills, model, scheduled-tasks, workspaces, or usage");
    expect(skillContent).toContain("requestSelfApi");
    expect(skillContent).toContain("/api/v1/xxxx");
    expect(skillContent).toContain("references/agent-api.md");
    expect(skillContent).toContain("references/plugin-api.md");
    expect(skillContent).toContain("references/model-api.md");
    expect(skillContent).toContain("references/scheduled-task-api.md");
    expect(skillContent).toContain("references/workspace-api.md");
    expect(skillContent).toContain("references/usage-api.md");
    expect(skillContent).toContain("references/skill-api.md");
    expect(agentApi).toContain("PATCH /api/v1/agents/tasks/:taskId");
    expect(agentApi).toMatch(/`taskId`: The id of the task/);
    expect(pluginApi).toMatch(/`sourceType`: Where to install the plugin from/);
    expect(modelApi).toMatch(/`apiKey`: The provider API key/);
    expect(scheduledTaskApi).toMatch(/`cronExpression`: Cron schedule/);
    expect(workspaceApi).toMatch(/`workspaceId`: The workspace id/);
    expect(usageApi).toMatch(/`groupBy`: Whether to group task usage/);
    expect(skillApi).toMatch(/`repositoryUrl`: Git repository URL/);

    for (const pattern of BLOCKED_SELF_API_ROUTE_PATTERNS) {
      expect(allReferences).not.toContain(pattern);
    }
    expect(allReferences).not.toMatch(/file-system/i);
    expect(allReferences).not.toContain("/health");
  });

  it("copies server skills into the dist skills directory", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "self-manager-build-"));
    const outDir = join(tempRoot, "dist");

    try {
      const plugin = createCopyServerSkillsPlugin({
        sourceDir: join(
          process.cwd(),
          "packages/plugins/self-manager/src/server/skills"
        ),
        outDir
      });

      await plugin.closeBundle?.();

      await expect(
        readFile(join(outDir, "skills/self-manager/SKILL.md"), "utf8")
      ).resolves.toContain("self-manager");
      await expect(
        readFile(join(outDir, "skills/self-manager/references/agent-api.md"), "utf8")
      ).resolves.toContain("requestSelfApi");
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });
});

function readReference(skillDir: string, filename: string): Promise<string> {
  return readFile(join(skillDir, "references", filename), "utf8");
}

async function resolveContribution(): Promise<ServerPlugin.Contribution> {
  if (!serverPlugin.contributionResolver) {
    throw new Error("Expected self-manager contribution resolver");
  }

  const resolver = serverPlugin.contributionResolver;
  if (typeof resolver !== "function") {
    return resolver;
  }

  return resolver({
    agentName: "main",
    env: { cwd: "/workspace" } as ServerPlugin.RuntimeContext["env"],
    isContinue: false,
    model: {} as ServerPlugin.RuntimeContext["model"],
    prompt: "",
    session: {} as ServerPlugin.RuntimeContext["session"],
    taskId: "task-1",
    thinkingLevel: "medium" as ServerPlugin.RuntimeContext["thinkingLevel"]
  });
}
