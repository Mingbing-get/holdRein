import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";

import {
  JsonlSessionRepo,
  NodeExecutionEnv,
  type AgentHarness,
  type JsonlSessionRepoApi
} from "@earendil-works/pi-agent-core/node";

import { SESSIONS_DIR, SKILL_DIR } from "../../../config/const";
import type { AgentSessionMetadata } from "../agent-types";

interface InterruptibleHarness {
  abort?: () => Promise<unknown> | unknown;
  interrupt?: () => Promise<unknown> | unknown;
}

export interface WorkspaceSkill {
  name: string;
  path: string;
}

export async function interruptHarness(harness: AgentHarness): Promise<void> {
  const interruptibleHarness = harness as unknown as InterruptibleHarness;

  if (interruptibleHarness.interrupt) {
    await interruptibleHarness.interrupt();
    return;
  }

  if (interruptibleHarness.abort) {
    await interruptibleHarness.abort();
    return;
  }

  throw new Error("Agent runtime does not support interruption");
}

export function createSessionRepo(): JsonlSessionRepoApi {
  return new JsonlSessionRepo({
    fs: new NodeExecutionEnv({ cwd: SESSIONS_DIR }),
    sessionsRoot: SESSIONS_DIR
  });
}

export function getSkillDirs(
  workspacePath: string,
  configuredSkillDirs?: string[]
): string[] {
  return Array.from(new Set([
    join(workspacePath, ".agents", "skills"),
    join(workspacePath, ".hold-rein", "skills"),
    SKILL_DIR,
    ...(configuredSkillDirs ?? [])
  ]));
}

export async function listWorkspaceSkills(
  workspacePath: string,
  configuredSkillDirs?: string[]
): Promise<WorkspaceSkill[]> {
  const skillDirs = getSkillDirs(workspacePath, configuredSkillDirs);
  const skills = await Promise.all(
    skillDirs.map((skillDir) => listSkillsInDir(skillDir))
  );

  return skills.flat();
}

async function listSkillsInDir(skillDir: string): Promise<WorkspaceSkill[]> {
  let entries: Dirent<string>[];

  try {
    entries = await readdir(skillDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const skillEntries = entries
    .filter((entry) => entry.isDirectory())
    .sort((leftEntry, rightEntry) => leftEntry.name.localeCompare(rightEntry.name));
  const skills = await Promise.all(
    skillEntries.map((entry) => readSkill(skillDir, entry.name))
  );

  return skills.filter((skill): skill is WorkspaceSkill => skill !== null);
}

async function readSkill(
  skillDir: string,
  skillFolderName: string
): Promise<WorkspaceSkill | null> {
  const skillPath = join(skillDir, skillFolderName);
  const skillFilePath = join(skillPath, "SKILL.md");

  try {
    const content = await readFile(skillFilePath, "utf8");

    return {
      name: parseSkillName(content) ?? basename(skillPath),
      path: skillPath
    };
  } catch {
    return null;
  }
}

function parseSkillName(content: string): string | undefined {
  const frontmatterMatch = /^---\n(?<frontmatter>[\s\S]*?)\n---/u.exec(content);
  const frontmatter = frontmatterMatch?.groups?.frontmatter;

  if (!frontmatter) {
    return undefined;
  }

  for (const line of frontmatter.split("\n")) {
    const nameMatch = /^name:\s*(?<name>.+?)\s*$/u.exec(line);
    const rawName = nameMatch?.groups?.name;

    if (rawName) {
      return rawName.replace(/^["']|["']$/gu, "");
    }
  }

  return undefined;
}

export function getEnvApiKey(provider: string): string | undefined {
  return process.env[`${provider.toUpperCase()}_API_KEY`];
}

export function toAgentSessionMetadata(metadata: {
  createdAt: string;
  id: string;
  path: string;
}): AgentSessionMetadata {
  return {
    createdAt: metadata.createdAt,
    id: metadata.id,
    path: metadata.path
  };
}
