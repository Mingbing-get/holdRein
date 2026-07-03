import { readFile } from "node:fs/promises";
import { join } from "node:path";

const MEMORY_DIRECTORY = ".hold-rein/memories";

export async function createMemorySystemPrompt(
  workspacePath: string
): Promise<string> {
  const indexContent = await readMemoryIndex(workspacePath);
  const guidance = [
    `Workspace memory is available in ${MEMORY_DIRECTORY}.`,
    "Use it as durable context when it is relevant to the current task."
  ].join(" ");

  if (indexContent === undefined) {
    return guidance;
  }

  return [guidance, "", "Primary memory:", indexContent].join("\n");
}

async function readMemoryIndex(
  workspacePath: string
): Promise<string | undefined> {
  try {
    return await readFile(
      join(workspacePath, MEMORY_DIRECTORY, "index.md"),
      "utf8"
    );
  } catch {
    return undefined;
  }
}
