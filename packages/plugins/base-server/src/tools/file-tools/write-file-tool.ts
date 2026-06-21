import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ExecutionEnv } from "@earendil-works/pi-agent-core";
import { Type, type Static } from "@earendil-works/pi-ai";
import type { ServerPlugin } from "@hold-rein/plugin-server";

import { resolveToolPath } from "./path-utils";

const writeFileParameters = Type.Object({
  path: Type.String({ description: "Path to the file to write." }),
  content: Type.String({ description: "Full file content to write." })
});

type WriteFileParameters = Static<typeof writeFileParameters>;

export function createWriteFileTool(env: ExecutionEnv): ServerPlugin.PluginTool {
  return {
    name: "write_file",
    label: "Write File",
    description:
      "Create or overwrite a UTF-8 text file, creating parent directories as needed.",
    parameters: writeFileParameters,
    beforeExecute({ event, requestApproval }) {
      const params = event.input as Partial<WriteFileParameters>;
      return requestApproval(`Allowed to write file: ${params.path ?? ""}`);
    },
    async execute(_toolCallId, rawParams, signal) {
      const params = rawParams as WriteFileParameters;
      throwIfAborted(signal);

      const absolutePath = resolveToolPath(env.cwd, params.path);
      await mkdir(dirname(absolutePath), { recursive: true });
      throwIfAborted(signal);

      await writeFile(absolutePath, params.content, "utf8");
      throwIfAborted(signal);

      return {
        content: [
          {
            type: "text",
            text: `Successfully wrote ${Buffer.byteLength(
              params.content,
              "utf8"
            )} bytes to ${params.path}.`
          }
        ],
        details: {
          path: absolutePath,
          bytes: Buffer.byteLength(params.content, "utf8")
        }
      };
    }
  };
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new Error("Operation aborted");
  }
}
