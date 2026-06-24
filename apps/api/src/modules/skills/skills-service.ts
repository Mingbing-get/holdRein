import { execFile } from "node:child_process";
import type { Dirent } from "node:fs";
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";

import { SKILL_DIR } from "../../config/const";
import type { InstalledSkill, SkillsConfig, SkillsService } from "./skills-types";

const execFileAsync = promisify(execFile);
const CONFIG_FILE_NAME = "skills.json";

export interface CreateSkillsServiceOptions {
  installGitRepository?: (
    repositoryUrl: string,
    targetDir: string,
    ref?: string
  ) => Promise<void>;
  rootDir?: string;
}

interface GithubSkillSource {
  ref?: string;
  repositoryUrl: string;
  skillId: string;
  skillSubdirectory?: string;
}

export function createSkillsService(
  options: CreateSkillsServiceOptions = {}
): SkillsService {
  const rootDir = options.rootDir ?? SKILL_DIR;
  const configPath = join(rootDir, CONFIG_FILE_NAME);
  const installGitRepository =
    options.installGitRepository ?? cloneGitRepository;
  let config: SkillsConfig = {};
  let loaded = false;

  const ensureLoaded = async () => {
    if (loaded) {
      return;
    }
    await mkdir(rootDir, { recursive: true });
    config = await readConfig(configPath);
    loaded = true;
  };

  const persistConfig = async () => {
    await mkdir(rootDir, { recursive: true });
    await writeFile(
      configPath,
      `${JSON.stringify(normalizeConfig(config), null, 2)}\n`,
      "utf8"
    );
  };

  const listSkills = async (): Promise<InstalledSkill[]> => {
    await ensureLoaded();
    const entries = await readSkillEntries(rootDir);
    const skills = await Promise.all(
      entries.map((entry) => readInstalledSkill(rootDir, entry.name, config))
    );

    return skills
      .filter((skill): skill is InstalledSkill => skill !== null)
      .sort((leftSkill, rightSkill) =>
        leftSkill.name.localeCompare(rightSkill.name)
      );
  };

  return {
    installSkill: async (repositoryUrl) => {
      await ensureLoaded();
      const source = getSkillSourceFromGithubUrl(repositoryUrl);
      const skillId = source.skillId;
      const targetDir = join(rootDir, skillId);
      const existing = await readInstalledSkill(rootDir, skillId, config);

      if (existing) {
        throw new Error("Skill is already installed");
      }

      await installSkillSource(source, targetDir, installGitRepository);
      const installedSkill = await readInstalledSkill(rootDir, skillId, config);

      if (!installedSkill) {
        await rm(targetDir, { force: true, recursive: true });
        throw new Error("Installed repository does not contain SKILL.md");
      }

      return installedSkill;
    },
    listEnabledSkillDirs: async () => {
      const skills = await listSkills();

      return skills
        .filter((skill) => !skill.disabled)
        .map((skill) => skill.path);
    },
    listSkills,
    load: async () => {
      await mkdir(rootDir, { recursive: true });
      config = await readConfig(configPath);
      loaded = true;
    },
    setSkillDisabled: async (skillId, disabled) => {
      await ensureLoaded();
      const skill = await readInstalledSkill(rootDir, skillId, config);

      if (!skill) {
        return null;
      }

      config = normalizeConfig({
        ...config,
        [skillId]: {
          ...config[skillId],
          disabled
        }
      });
      await persistConfig();

      return { ...skill, disabled };
    },
    uninstallSkill: async (skillId) => {
      await ensureLoaded();
      const skill = await readInstalledSkill(rootDir, skillId, config);

      if (!skill) {
        return false;
      }

      await rm(skill.path, { force: true, recursive: true });
      const { [skillId]: _removed, ...remainingConfig } = config;
      config = normalizeConfig(remainingConfig);
      await persistConfig();
      return true;
    }
  };
}

async function readConfig(configPath: string): Promise<SkillsConfig> {
  try {
    return normalizeConfig(JSON.parse(await readFile(configPath, "utf8")));
  } catch {
    return {};
  }
}

function normalizeConfig(value: unknown): SkillsConfig {
  if (!value || typeof value !== "object") {
    return {};
  }
  const legacyDisabledSkillIds = (value as { disabledSkillIds?: unknown })
    .disabledSkillIds;

  if (Array.isArray(legacyDisabledSkillIds)) {
    return Object.fromEntries(
      [...new Set(legacyDisabledSkillIds.filter(isNonEmptyString))]
        .sort()
        .map((skillId) => [skillId, { disabled: true }])
    );
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([skillId, entry]) => isNonEmptyString(skillId) && isPlainObject(entry))
      .sort(([leftSkillId], [rightSkillId]) =>
        leftSkillId.localeCompare(rightSkillId)
      )
      .map(([skillId, entry]) => [skillId, normalizeConfigEntry(entry)])
  );
}

function normalizeConfigEntry(entry: Record<string, unknown>) {
  const normalizedEntry = { ...entry };

  if (typeof normalizedEntry.disabled !== "boolean") {
    delete normalizedEntry.disabled;
  }

  return normalizedEntry;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readSkillEntries(rootDir: string): Promise<Dirent<string>[]> {
  try {
    return (await readdir(rootDir, { withFileTypes: true })).filter((entry) =>
      entry.isDirectory()
    );
  } catch {
    return [];
  }
}

async function readInstalledSkill(
  rootDir: string,
  skillId: string,
  config: SkillsConfig
): Promise<InstalledSkill | null> {
  const skillPath = join(rootDir, skillId);

  try {
    const content = await readFile(join(skillPath, "SKILL.md"), "utf8");

    return {
      disabled: config[skillId]?.disabled === true,
      id: skillId,
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

async function installSkillSource(
  source: GithubSkillSource,
  targetDir: string,
  installGitRepository: (
    repositoryUrl: string,
    targetDir: string,
    ref?: string
  ) => Promise<void>
): Promise<void> {
  if (!source.skillSubdirectory) {
    if (source.ref) {
      await installGitRepository(source.repositoryUrl, targetDir, source.ref);
    } else {
      await installGitRepository(source.repositoryUrl, targetDir);
    }
    return;
  }

  const cloneDir = await mkdtemp(join(tmpdir(), "hold-rein-skill-"));

  try {
    await installGitRepository(source.repositoryUrl, cloneDir, source.ref);
    await cp(join(cloneDir, source.skillSubdirectory), targetDir, {
      errorOnExist: true,
      recursive: true
    });
  } catch (error) {
    await rm(targetDir, { force: true, recursive: true });
    throw error;
  } finally {
    await rm(cloneDir, { force: true, recursive: true });
  }
}

function getSkillSourceFromGithubUrl(repositoryUrl: string): GithubSkillSource {
  const trimmedUrl = repositoryUrl.trim();
  const rootMatch =
    /^https:\/\/github\.com\/[^/\s]+\/(?<repo>[^/\s]+?)(?:\.git)?\/?$/u.exec(
      trimmedUrl
    ) ??
    /^git@github\.com:[^/\s]+\/(?<repo>[^/\s]+?)(?:\.git)?$/u.exec(trimmedUrl);
  const rootRepo = rootMatch?.groups?.repo;

  if (rootRepo && isValidRepositoryName(rootRepo)) {
    return {
      repositoryUrl: trimmedUrl,
      skillId: rootRepo
    };
  }

  const webMatch =
    /^https:\/\/github\.com\/[^/\s]+\/(?<repo>[^/\s]+)\/(?<kind>tree|blob)\/(?<ref>[^/\s]+)(?:\/(?<path>.*))?\/?$/u.exec(
      trimmedUrl
    );
  const repo = webMatch?.groups?.repo;
  const kind = webMatch?.groups?.kind;
  const ref = webMatch?.groups?.ref;
  const path = webMatch?.groups?.path;

  if (!repo || !kind || !ref || !isValidRepositoryName(repo)) {
    throw new Error("repositoryUrl must be a GitHub repository URL");
  }

  const pathSegments = normalizeGithubPathSegments(path);
  const skillSubdirectory =
    kind === "blob"
      ? getSkillDirectoryFromBlobPath(pathSegments)
      : pathSegments.join("/");

  const source: GithubSkillSource = {
    ref,
    repositoryUrl: getHttpsGitRepositoryUrl(trimmedUrl, repo),
    skillId: basename(skillSubdirectory || repo)
  };

  if (skillSubdirectory) {
    source.skillSubdirectory = skillSubdirectory;
  }

  return source;
}

function getSkillDirectoryFromBlobPath(pathSegments: string[]): string {
  if (pathSegments.at(-1) !== "SKILL.md") {
    throw new Error("repositoryUrl must be a GitHub repository URL");
  }

  return pathSegments.slice(0, -1).join("/");
}

function getHttpsGitRepositoryUrl(trimmedUrl: string, repo: string): string {
  const repositoryBaseMatch = new RegExp(
    `^(?<base>https://github\\.com/[^/\\s]+/${escapeRegExp(repo)})/`,
    "u"
  ).exec(trimmedUrl);
  const repositoryBase = repositoryBaseMatch?.groups?.base;

  if (!repositoryBase) {
    throw new Error("repositoryUrl must be a GitHub repository URL");
  }

  return `${repositoryBase}.git`;
}

function normalizeGithubPathSegments(path: string | undefined): string[] {
  if (!path) {
    return [];
  }

  const segments = path.split("/").filter((segment) => segment.length > 0);

  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("repositoryUrl must be a GitHub repository URL");
  }

  return segments;
}

function isValidRepositoryName(repo: string): boolean {
  return /^[A-Za-z0-9._-]+$/u.test(repo);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

async function cloneGitRepository(
  repositoryUrl: string,
  targetDir: string,
  ref?: string
): Promise<void> {
  const args = ref
    ? ["clone", "--depth", "1", "--branch", ref, repositoryUrl, targetDir]
    : ["clone", "--depth", "1", repositoryUrl, targetDir];

  await execFileAsync("git", args);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
