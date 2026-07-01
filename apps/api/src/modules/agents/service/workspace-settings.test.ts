import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { resolveWorkspaceCapabilities } from "./workspace-settings";

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryPaths.splice(0).map((path) => rmTemp(path))
  );
});

describe("workspace settings", () => {
  it("leaves capabilities unrestricted when the workspace setting file is missing", async () => {
    const workspacePath = await createWorkspace();

    await expect(
      resolveWorkspaceCapabilities({
        activePlugins: ["plugin-a"],
        activeSkills: ["skill-a"],
        workspacePath
      })
    ).resolves.toEqual({
      activePlugins: ["plugin-a"],
      activeSkills: ["skill-a"]
    });
  });

  it("uses configured capabilities when no runtime capabilities are provided", async () => {
    const workspacePath = await createWorkspaceSetting({
      activePlugins: ["plugin-a", "plugin-b"],
      activeSkills: ["skill-a", "skill-b"]
    });

    await expect(
      resolveWorkspaceCapabilities({ workspacePath })
    ).resolves.toEqual({
      activePlugins: ["plugin-a", "plugin-b"],
      activeSkills: ["skill-a", "skill-b"]
    });
  });

  it("intersects configured and runtime capabilities when both are provided", async () => {
    const workspacePath = await createWorkspaceSetting({
      activePlugins: ["plugin-b", "plugin-c"],
      activeSkills: ["skill-b", "skill-c"]
    });

    await expect(
      resolveWorkspaceCapabilities({
        activePlugins: ["plugin-a", "plugin-b"],
        activeSkills: ["skill-a", "skill-b"],
        workspacePath
      })
    ).resolves.toEqual({
      activePlugins: ["plugin-b"],
      activeSkills: ["skill-b"]
    });
  });
});

async function createWorkspace(): Promise<string> {
  const workspacePath = await mkdtemp(join(tmpdir(), "hold-rein-workspace-"));
  temporaryPaths.push(workspacePath);

  return workspacePath;
}

async function createWorkspaceSetting(setting: unknown): Promise<string> {
  const workspacePath = await createWorkspace();
  const settingDirectory = join(workspacePath, ".hold-rein");
  await mkdir(settingDirectory);
  await writeFile(
    join(settingDirectory, "setting.json"),
    JSON.stringify(setting)
  );

  return workspacePath;
}

async function rmTemp(path: string): Promise<void> {
  const { rm } = await import("node:fs/promises");
  await rm(path, { force: true, recursive: true });
}
