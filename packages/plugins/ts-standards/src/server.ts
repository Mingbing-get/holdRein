import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ServerPlugin } from "@hold-rein/plugin-server";
import { PLUGIN_ID } from './plugin-id'

const VALIDATOR_MARKER = "[ts-standards-validator]";
const VALIDATOR_AGENT_NAME = "ts-standards-validator";
const VALIDATOR_SKILL_DIR = join(skillRootDir(), "validator");
const PLANNING_SKILL_DIR = join(skillRootDir(), "planning");
const STANDARDS_SKILL_DIR = join(skillRootDir(), "ts-standards");

export interface ProjectDetectionResult {
  detected: boolean;
  reasons: string[];
}

export type FileChangeOperation = "delete" | "edit" | "write";

export interface ChangedFile {
  absolutePath?: string;
  operation: FileChangeOperation;
  path: string;
  toolCallId: string;
}

export interface ValidationPromptInput {
  changedFiles: ChangedFile[];
  originalPrompt: string;
}

interface ToolCallRecord {
  operation: FileChangeOperation;
  path: string;
  toolCallId: string;
}

const tsStandardsServerPlugin: ServerPlugin.Plugin = {
  id: PLUGIN_ID,
  contributionResolver: async (context) => {
    const detection = await detectTsProject(context.env.cwd);
    const isValidator = isValidatorPrompt(context.prompt);

    return {
      skillDirs: [
        PLANNING_SKILL_DIR,
        ...(detection.detected ? [STANDARDS_SKILL_DIR] : []),
        ...(isValidator ? [VALIDATOR_SKILL_DIR] : [])
      ],
      systemPrompts: [
        ...(context.agentName === "main"
          ? [
              "Use the planning skill to break down implementation work before editing code."
            ]
          : []),
        ...(detection.detected
          ? [
              "This workspace looks like a TypeScript or JavaScript project. Use the ts-standards skill for code organization, tests, and verification."
            ]
          : [])
      ],
      async onAgentEnd(input) {
        if (!detection.detected || isValidatorPrompt(input.runInput.prompt)) {
          return undefined;
        }

        const changedFiles = extractChangedFilesFromMessages(input.messages, {
          afterLatestCustomMessageFromAgent: VALIDATOR_AGENT_NAME
        });

        if (changedFiles.length === 0) {
          return undefined;
        }

        return {
          agentName: VALIDATOR_AGENT_NAME,
          prompt: createValidationPrompt({
            changedFiles,
            originalPrompt: input.runInput.prompt
          }),
          useSubagent: true
        };
      }
    };
  }
};

export default tsStandardsServerPlugin;

export async function detectTsProject(
  workspacePath: string
): Promise<ProjectDetectionResult> {
  const reasons: string[] = [];

  if (await fileExists(join(workspacePath, "package.json"))) {
    reasons.push("package.json");
  }

  for (const fileName of [
    "tsconfig.json",
    "vite.config.ts",
    "vite.config.js",
    "next.config.js",
    "next.config.mjs",
    "next.config.ts",
    "pnpm-workspace.yaml"
  ]) {
    if (await fileExists(join(workspacePath, fileName))) {
      reasons.push(fileName);
    }
  }

  const packageJson = await readPackageJson(join(workspacePath, "package.json"));
  const hasPackageSignal = hasTsJsPackageSignal(packageJson);

  return {
    detected: reasons.length > 0 || hasPackageSignal,
    reasons
  };
}

export function extractChangedFilesFromMessages(
  messages: readonly unknown[],
  options: { afterLatestCustomMessageFromAgent?: string } = {}
): ChangedFile[] {
  const scopedMessages = scopeMessagesAfterLatestCustomMessageFromAgent(
    messages,
    options.afterLatestCustomMessageFromAgent
  );
  const calls = new Map<string, ToolCallRecord>();
  const changes: ChangedFile[] = [];

  for (const message of scopedMessages) {
    for (const toolCall of getToolCalls(message)) {
      calls.set(toolCall.toolCallId, toolCall);
    }

    const result = getToolResult(message);
    if (!result || result.isError) {
      continue;
    }

    const call = calls.get(result.toolCallId);
    if (!call || result.toolName !== toolNameForOperation(call.operation)) {
      continue;
    }

    changes.push({
      operation: call.operation,
      path: call.path,
      toolCallId: call.toolCallId,
      ...(result.absolutePath === undefined
        ? {}
        : { absolutePath: result.absolutePath })
    });
  }

  return dedupeChangedFiles(changes);
}

export function createValidationPrompt(input: ValidationPromptInput): string {
  const changedFiles = input.changedFiles
    .map((file) => {
      const absolutePath = file.absolutePath ? ` (${file.absolutePath})` : "";
      return `- ${file.operation} ${file.path}${absolutePath}`;
    })
    .join("\n");

  return [
    VALIDATOR_MARKER,
    "",
    "You are an independent validation subagent for a TypeScript/JavaScript coding task.",
    "Do not rely on the implementing agent's conclusions. Use only this prompt, the changed files, and the workspace files you inspect yourself.",
    "",
    "Original task:",
    input.originalPrompt,
    "",
    "Changed files from the implementing agent:",
    changedFiles,
    "",
    "Validation duties:",
    "1. Read project rules such as AGENTS.md, package.json, tsconfig, ESLint config, and nearby tests.",
    "2. Run the relevant test command for the changed behavior. Prefer the narrowest reliable command, but broaden when needed.",
    "3. Check code style and organization against project rules, including file size limits, test placement, folder APIs, and TypeScript public types.",
    "4. Check task completion against the original task, including missing edge cases or incomplete UI/API behavior.",
    "",
    "Return a concise structured result:",
    "Status: passed | failed",
    "Test Commands: list each command and result",
    "Findings: required fixes with file paths when failed",
    "Completion Review: whether the original task is satisfied",
    "",
    "If validation fails, tell the implementing agent exactly what to change. If validation passes, say so directly."
  ].join("\n");
}

function skillRootDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "skills");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readPackageJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch {
    return undefined;
  }
}

function hasTsJsPackageSignal(packageJson: unknown): boolean {
  if (!isRecord(packageJson)) {
    return false;
  }

  const dependencyNames = [
    ...Object.keys(readRecord(packageJson.dependencies)),
    ...Object.keys(readRecord(packageJson.devDependencies))
  ];
  const scripts = readRecord(packageJson.scripts);

  return (
    dependencyNames.some((name) =>
      [
        "typescript",
        "react",
        "vite",
        "next",
        "express",
        "hono",
        "fastify",
        "vitest"
      ].includes(name)
    ) ||
    Object.values(scripts).some(
      (value) => typeof value === "string" && /(?:tsc|vite|vitest|tsx)/u.test(value)
    )
  );
}

function scopeMessagesAfterLatestCustomMessageFromAgent(
  messages: readonly unknown[],
  agentName: string | undefined
): readonly unknown[] {
  if (!agentName) {
    return messages;
  }

  let latestAgentMessageIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (getCustomMessageAgentName(messages[index]) === agentName) {
      latestAgentMessageIndex = index;
      break;
    }
  }

  return latestAgentMessageIndex === -1
    ? messages
    : messages.slice(latestAgentMessageIndex + 1);
}

function getToolCalls(message: unknown): ToolCallRecord[] {
  if (!isRecord(message) || !Array.isArray(message.content)) {
    return [];
  }

  return message.content.flatMap((content) => {
    if (!isRecord(content) || content.type !== "toolCall") {
      return [];
    }

    const toolCallId = typeof content.id === "string" ? content.id : undefined;
    const toolName = typeof content.name === "string" ? content.name : undefined;
    const args = isRecord(content.arguments) ? content.arguments : {};
    const path = typeof args.path === "string" ? args.path : undefined;
    const operation = operationForToolName(toolName);

    if (!toolCallId || !path || !operation) {
      return [];
    }

    return [{ operation, path, toolCallId }];
  });
}

function getToolResult(message: unknown):
  | {
      absolutePath?: string;
      isError: boolean;
      toolCallId: string;
      toolName: string;
    }
  | undefined {
  if (!isRecord(message) || message.role !== "toolResult") {
    return undefined;
  }

  const toolCallId =
    typeof message.toolCallId === "string" ? message.toolCallId : undefined;
  const toolName = typeof message.toolName === "string" ? message.toolName : undefined;

  if (!toolCallId || !toolName) {
    return undefined;
  }

  const absolutePath = readDetailsPath(message.details);

  return {
    isError: message.isError === true,
    toolCallId,
    toolName,
    ...(absolutePath === undefined ? {} : { absolutePath })
  };
}

function getCustomMessageAgentName(message: unknown): string | undefined {
  if (!isRecord(message) || message.role !== "custom" || !isRecord(message.details)) {
    return undefined;
  }

  return typeof message.details.agentName === "string"
    ? message.details.agentName
    : undefined;
}

function dedupeChangedFiles(changes: ChangedFile[]): ChangedFile[] {
  const byPath = new Map<string, ChangedFile>();

  for (const change of changes) {
    byPath.set(change.path, change);
  }

  return [...byPath.values()];
}

function operationForToolName(toolName: string | undefined): FileChangeOperation | undefined {
  if (toolName === "write_file") {
    return "write";
  }
  if (toolName === "edit_file") {
    return "edit";
  }
  if (toolName === "delete_file") {
    return "delete";
  }
  return undefined;
}

function toolNameForOperation(operation: FileChangeOperation): string {
  return `${operation}_file`;
}

function readDetailsPath(details: unknown): string | undefined {
  return isRecord(details) && typeof details.path === "string"
    ? details.path
    : undefined;
}

function isValidatorPrompt(prompt: string): boolean {
  return prompt.includes(VALIDATOR_MARKER);
}

function readRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
