import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ServerPlugin } from "@hold-rein/plugin-server";
import { PLUGIN_ID } from "./plugin-id";

const SELF_MANAGER_SKILL_DIR = join(skillRootDir(), "self-manager");

const baseServerPlugin: ServerPlugin.Plugin = {
  id: PLUGIN_ID,
  contributionResolver: {
    skillDirs: [SELF_MANAGER_SKILL_DIR]
  }
};

export default baseServerPlugin;

function skillRootDir(): string {
  const baseDir = dirname(fileURLToPath(import.meta.url));
  const sourceSkillRoot = join(baseDir, "server/skills");

  return existsSync(sourceSkillRoot)
    ? sourceSkillRoot
    : join(baseDir, "skills");
}
