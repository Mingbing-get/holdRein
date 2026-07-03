import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { Skill } from "@earendil-works/pi-agent-core";

export interface InlineSkillReference {
  content: string;
  path: string;
}

export interface InlineRuntimeSkill {
  content: string;
  description?: string;
  name: string;
  references?: readonly InlineSkillReference[];
}

export interface MaterializeInlineSkillsInput {
  rootDir: string;
  skills: readonly InlineRuntimeSkill[];
}

export interface MaterializedInlineSkills {
  cleanup: () => Promise<void>;
  directory: string;
  skills: Skill[];
}

export interface CleanupStaleMaterializedSkillsInput {
  maxAgeMs: number;
  now?: number;
  rootDir: string;
}

export async function cleanupStaleMaterializedSkills(
  input: CleanupStaleMaterializedSkillsInput
): Promise<void> {
  const entries = await readdir(input.rootDir, { withFileTypes: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  );
  const now = input.now ?? Date.now();
  await Promise.all(entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("harness-"))
    .map(async (entry) => {
      const directory = join(input.rootDir, entry.name);
      const info = await stat(directory);
      if (now - info.mtimeMs > input.maxAgeMs) {
        await rm(directory, { force: true, recursive: true });
      }
    }));
}

export async function materializeInlineSkills(
  input: MaterializeInlineSkillsInput
): Promise<MaterializedInlineSkills> {
  await mkdir(input.rootDir, { recursive: true });
  const directory = await mkdtemp(join(input.rootDir, "harness-"));

  try {
    const skills = await Promise.all(
      input.skills.map((skill, index) => writeSkill(directory, skill, index))
    );

    return {
      cleanup: () => rm(directory, { force: true, recursive: true }),
      directory,
      skills
    };
  } catch (error) {
    await rm(directory, { force: true, recursive: true });
    throw error;
  }
}

export async function createWithMaterializedSkills<T>(
  materialized: Pick<MaterializedInlineSkills, "cleanup">,
  create: () => T
): Promise<T> {
  try {
    return create();
  } catch (error) {
    await materialized.cleanup();
    throw error;
  }
}

async function writeSkill(
  directory: string,
  skill: InlineRuntimeSkill,
  index: number
): Promise<Skill> {
  if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(skill.name)) {
    throw new Error(`Invalid inline skill name: ${skill.name}`);
  }

  const skillDirectory = join(directory, `${index}-${skill.name}`);
  const referencesDirectory = join(skillDirectory, "references");
  await mkdir(skillDirectory, { recursive: true });
  const filePath = join(skillDirectory, "SKILL.md");
  await writeFile(filePath, skill.content, "utf8");

  const referencePaths = new Set<string>();
  for (const reference of skill.references ?? []) {
    const referencePath = validateReferencePath(reference.path);
    if (referencePaths.has(referencePath)) {
      throw new Error(`Duplicate skill reference path: ${reference.path}`);
    }
    referencePaths.add(referencePath);
    const targetPath = join(referencesDirectory, ...referencePath.split("/"));
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, reference.content, "utf8");
  }

  return {
    content: skill.content,
    description: skill.description ?? "",
    filePath,
    name: skill.name
  };
}

function validateReferencePath(path: string): string {
  const normalized = path.startsWith("./") ? path.slice(2) : path;
  const segments = normalized.split("/");
  const valid =
    normalized.endsWith(".md") &&
    !normalized.startsWith("/") &&
    !normalized.includes("\\") &&
    segments.every((segment) => segment !== "" && segment !== "." && segment !== "..");

  if (!valid) {
    throw new Error(`Invalid skill reference path: ${path}`);
  }

  return normalized;
}
