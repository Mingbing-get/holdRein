import type { Skill } from "@earendil-works/pi-agent-core";

import type {
  BrowserRuntimeContributions,
  BrowserRuntimeSkill,
  BrowserRuntimeToolSchema
} from "../agent-types";

const MAX_TOOLS = 16;
const MAX_SKILLS = 16;
const MAX_SYSTEM_PROMPTS = 16;
const MAX_NAME_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_SKILL_CONTENT_LENGTH = 20_000;
const MAX_SYSTEM_PROMPT_LENGTH = 20_000;

export function parseBrowserRuntimeContributions(
  value: unknown
): BrowserRuntimeContributions | undefined | null {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return null;

  const tools = parseTools(value.tools);
  const skills = parseSkills(value.skills);
  const systemPrompts = parseSystemPrompts(value.systemPrompts);

  if (tools === null || skills === null || systemPrompts === null) return null;

  return {
    ...(skills === undefined ? {} : { skills }),
    ...(systemPrompts === undefined ? {} : { systemPrompts }),
    ...(tools === undefined ? {} : { tools })
  };
}

export function toRuntimeSkills(
  skills: readonly BrowserRuntimeSkill[] | undefined
): Skill[] {
  return (skills ?? []).map((skill) => ({
    content: skill.content,
    description: skill.description ?? "",
    filePath: `browser-runtime://${skill.name}/SKILL.md`,
    name: skill.name
  }));
}

function parseTools(
  value: unknown
): BrowserRuntimeToolSchema[] | undefined | null {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > MAX_TOOLS) return null;

  const names = new Set<string>();
  const tools: BrowserRuntimeToolSchema[] = [];

  for (const item of value) {
    if (!isRecord(item)) return null;
    const name = parseName(item.name);
    const description = parseOptionalString(
      item.description,
      MAX_DESCRIPTION_LENGTH
    );
    if (!name || description === null || item.inputSchema === undefined) {
      return null;
    }
    if (names.has(name)) return null;
    names.add(name);
    tools.push({
      ...(description === undefined ? {} : { description }),
      inputSchema: item.inputSchema,
      name
    });
  }

  return tools;
}

function parseSkills(value: unknown): BrowserRuntimeSkill[] | undefined | null {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > MAX_SKILLS) return null;

  const skills: BrowserRuntimeSkill[] = [];

  for (const item of value) {
    if (!isRecord(item)) return null;
    const name = parseName(item.name);
    const description = parseOptionalString(
      item.description,
      MAX_DESCRIPTION_LENGTH
    );
    const content = parseRequiredString(
      item.content,
      MAX_SKILL_CONTENT_LENGTH
    );
    if (!name || description === null || content === null) return null;
    skills.push({
      content,
      ...(description === undefined ? {} : { description }),
      name
    });
  }

  return skills;
}

function parseSystemPrompts(value: unknown): string[] | undefined | null {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > MAX_SYSTEM_PROMPTS) return null;

  const prompts: string[] = [];

  for (const item of value) {
    const prompt = parseRequiredString(item, MAX_SYSTEM_PROMPT_LENGTH);
    if (prompt === null) return null;
    prompts.push(prompt);
  }

  return prompts;
}

function parseName(value: unknown): string | null {
  const name = parseRequiredString(value, MAX_NAME_LENGTH);
  if (!name) return null;
  return /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name) ? name : null;
}

function parseRequiredString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

function parseOptionalString(
  value: unknown,
  maxLength: number
): string | null | undefined {
  if (value === undefined) return undefined;
  return parseRequiredString(value, maxLength);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
