import { readFile } from "node:fs/promises";
import { join } from "node:path";

const WORKSPACE_AGENT_INSTRUCTIONS_FILE = "AGENTS.md";

export async function readWorkspaceAgentInstructions(
  workspacePath: string
): Promise<string | undefined> {
  try {
    const content = await readFile(
      join(workspacePath, WORKSPACE_AGENT_INSTRUCTIONS_FILE),
      "utf8"
    );
    const trimmedContent = content.trim();

    return trimmedContent === "" ? undefined : trimmedContent;
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }

    throw error;
  }
}

export function formatWorkspaceAgentInstructionsForSystemPrompt(
  instructions: string | undefined
): string | undefined {
  if (instructions === undefined) {
    return undefined;
  }

  return [
    "Workspace AGENTS.md mandatory constraints:",
    instructions
  ].join("\n\n");
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}
