import { unlink } from "node:fs/promises";
import type { ExecutionEnv } from "@earendil-works/pi-agent-core";
import { Type, type Static } from "@earendil-works/pi-ai";
import type { ServerPlugin } from "@hold-rein/plugin-server";

import { resolveToolPath } from "./path-utils";

const deleteFileParameters = Type.Object({
  path: Type.String({ description: "Path to the file to delete." })
});

type DeleteFileParameters = Static<typeof deleteFileParameters>;

export function createDeleteFileTool(env: ExecutionEnv): ServerPlugin.PluginTool {
  return {
    name: "delete_file",
    label: "Delete File",
    description: "Delete a file from the workspace.",
    parameters: deleteFileParameters,
    beforeExecute({ event, requestApproval }) {
      const params = event.input as Partial<DeleteFileParameters>;
      return requestApproval(`Allowed to delete file: ${params.path ?? ""}`);
    },
    async execute(_toolCallId, rawParams, signal) {
      const params = rawParams as DeleteFileParameters;
      throwIfAborted(signal);

      const absolutePath = resolveToolPath(env.cwd, params.path);
      await unlink(absolutePath);
      throwIfAborted(signal);

      return {
        content: [
          {
            type: "text",
            text: `Successfully deleted ${params.path}.`
          }
        ],
        details: {
          path: absolutePath
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
