import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ServerPlugin } from "@hold-rein/plugin-server";
import { PLUGIN_ID } from './plugin-id'

const VALIDATOR_MARKER = "[ts-standards-validator]";
const VALIDATOR_AGENT_NAME = "ts-standards-validator";
const MEMORY_ORGANIZER_AGENT_NAME = "memory-organizer";
const PLANNER_SKILL_DIR = join(skillRootDir(), "planner");
const BUGFIX_SKILL_DIR = join(skillRootDir(), "bugfix");
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
    if (context.agentName === MEMORY_ORGANIZER_AGENT_NAME) {
      return {};
    }

    const detection = await detectTsProject(context.env.cwd);

    return {
      skillDirs: [
        ...(context.agentName === "main"
          ? [PLANNER_SKILL_DIR, BUGFIX_SKILL_DIR]
          : []),
        ...(detection.detected ? [STANDARDS_SKILL_DIR] : [])
      ],
      systemPrompts: [
        ...(context.agentName === "main"
          ? [
              [
                "Before any task that may involve code changes, first make sure you fully understand the user's requirements.",
                "You may read workspace files to learn project context, but if anything remains unclear, stop and ask the user before planning or writing code.",
                "For a new feature, use the planner skill to design and decompose the work before implementation.",
                "For a bug fix, use the bugfix skill and follow its diagnosis and test-first workflow.",
                "When a task contains many independent feature areas, you may split them among focused subagents."
              ].join(" ")
            ]
          : []),
        ...(detection.detected
          ? [
              "This workspace looks like a TypeScript or JavaScript project. Any agent that will write code must ensure the ts-standards skill is installed and must use the ts-standards skill before writing code, including writing tests before implementation."
            ]
          : [])
      ],
      async onAgentEnd(input) {
        if (!detection.detected || isValidatorPrompt(input.runInput.prompt)) {
          return undefined;
        }

        const validationMessages = scopeValidationMessages(
          input.messages,
          VALIDATOR_AGENT_NAME
        );
        const changedFiles = extractChangedFilesFromMessages(validationMessages);

        if (changedFiles.length === 0) {
          return undefined;
        }

        return {
          agentName: VALIDATOR_AGENT_NAME,
          prompt: createValidationPrompt({
            changedFiles,
            originalPrompt: extractUserMessageText(validationMessages)
          }),
          useSubagent: true,
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
    "This is a strictly read-only validation. Do not modify, create, delete, or format any file.",
    "Only inspect the changed or newly added files listed below for compliance. You may read project configuration and rules only to determine the applicable standards; do not review unrelated source files.",
    "",
    "Original task:",
    input.originalPrompt,
    "",
    "Changed files from the implementing agent:",
    changedFiles,
    "",
    "Validation duties:",
    "1. Read applicable rules such as AGENTS.md, package.json, tsconfig, and ESLint config. Check only the listed changed/new files against those rules and the ts-standards folder structure rules.",
    "2. Check whether every changed behavior has sufficient and comprehensive tests covering functionality, interactions, edge cases, and multiple possible outcomes. CSS does not require tests and CSS appearance must not be tested.",
    "3. Run the relevant tests and record every command and its actual result, including failures.",
    "4. Run the project's code-style or lint script and record its actual result, including failures.",
    "5. Check the listed files' organization, including single responsibility, folder structure, colocated index tests, child feature folders, public index exports, file-size limits, and all applicable AGENTS.md rules.",
    "",
    "Return a concise structured result:",
    "Status: passed | failed",
    "File Organization: result for each listed file and the rule checked",
    "Test Coverage: covered and missing scenarios for each changed non-CSS behavior",
    "Test Commands: every command and its actual pass/fail result",
    "Style Command: the command and its actual pass/fail result",
    "Summary: a factual consolidation of all passed and failed checks",
    "",
    "Report every check whether it passes or fails. For failures, identify the exact file, test, missing scenario, command error, or violated rule.",
    "Do not provide fixes or modification suggestions. Do not edit files after reporting."
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

function scopeValidationMessages(
  messages: readonly unknown[],
  validatorAgentName: string
): readonly unknown[] {
  const messagesAfterValidator = scopeMessagesAfterLatestCustomMessageFromAgent(
    messages,
    validatorAgentName
  );
  const firstUserMessageIndex = messagesAfterValidator.findIndex(
    (message) => getUserMessageText(message) !== undefined
  );

  return firstUserMessageIndex === -1
    ? []
    : messagesAfterValidator.slice(firstUserMessageIndex);
}

function extractUserMessageText(messages: readonly unknown[]): string {
  return messages.flatMap((message) => {
    const text = getUserMessageText(message);
    return text === undefined ? [] : [text];
  }).join("\n");
}

function getUserMessageText(message: unknown): string | undefined {
  if (!isRecord(message) || message.role !== "user") {
    return undefined;
  }

  const textParts =
    typeof message.content === "string"
      ? [message.content]
      : Array.isArray(message.content)
        ? message.content.flatMap((entry) =>
            isRecord(entry) && typeof entry.text === "string"
              ? [entry.text]
              : []
          )
        : [];
  const text = textParts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join("\n");

  return text.length === 0 ? undefined : text;
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
