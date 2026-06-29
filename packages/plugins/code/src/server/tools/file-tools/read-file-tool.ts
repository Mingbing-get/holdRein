import { readFile, stat } from "node:fs/promises";
import type { ExecutionEnv } from "@earendil-works/pi-agent-core";
import { Type, type Static } from "@earendil-works/pi-ai";
import type { ServerPlugin } from "@hold-rein/plugin-server";

import { resolveToolPath } from "./path-utils";
import { truncateText } from "./truncate";

const readFileParameters = Type.Object({
  path: Type.String({ description: "Path to the file to read." }),
  offset: Type.Optional(
    Type.Number({ description: "Line number to start reading from, 1-indexed." })
  ),
  limit: Type.Optional(Type.Number({ description: "Maximum number of lines." }))
});

type ReadFileParameters = Static<typeof readFileParameters>;

export function createReadFileTool(env: ExecutionEnv): ServerPlugin.PluginTool {
  return {
    name: "read_file",
    label: "Read File",
    description:
      "Read a UTF-8 text file. Use offset and limit for large files.",
    parameters: readFileParameters,
    async execute(_toolCallId, rawParams, signal) {
      const params = rawParams as ReadFileParameters;
      throwIfAborted(signal);

      const absolutePath = resolveToolPath(env.cwd, params.path);
      const fileStat = await stat(absolutePath);
      throwIfAborted(signal);

      if (!fileStat.isFile()) {
        throw new Error(`Path is not a file: ${params.path}`);
      }

      const content = await readFile(absolutePath, "utf8");
      throwIfAborted(signal);

      const selected = selectLineRange(content, params.offset, params.limit);
      const truncated = truncateText(selected);

      return {
        content: [{ type: "text", text: truncated.text }],
        details: {
          path: absolutePath,
          bytes: Buffer.byteLength(content, "utf8"),
          range:
            params.offset !== undefined || params.limit !== undefined
              ? { offset: params.offset ?? 1, limit: params.limit }
              : undefined,
          truncated: truncated.truncated
        }
      };
    }
  };
}

function selectLineRange(
  content: string,
  offset: number | undefined,
  limit: number | undefined
): string {
  if (offset === undefined && limit === undefined) {
    return content;
  }

  const lines = content.split(/\r\n|\n|\r/);
  const start = Math.max(0, (offset ?? 1) - 1);
  const end = limit === undefined ? lines.length : start + Math.max(0, limit);
  return lines.slice(start, end).join("\n");
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new Error("Operation aborted");
  }
}
