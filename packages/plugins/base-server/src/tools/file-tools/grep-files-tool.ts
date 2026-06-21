import { spawn } from "node:child_process";
import { relative, sep } from "node:path";
import type { ExecutionEnv } from "@earendil-works/pi-agent-core";
import { Type, type Static } from "@earendil-works/pi-ai";
import type { ServerPlugin } from "@hold-rein/plugin-server";

import { resolveToolPath } from "./path-utils";
import { truncateText } from "./truncate";

const DEFAULT_LIMIT = 100;

const grepFilesParameters = Type.Object({
  pattern: Type.String({ description: "Text or regex pattern to search for." }),
  path: Type.Optional(
    Type.String({ description: "Directory or file to search. Defaults to cwd." })
  ),
  glob: Type.Optional(
    Type.String({ description: "Limit matches by filename glob, e.g. *.ts." })
  ),
  ignoreCase: Type.Optional(
    Type.Boolean({ description: "Search case-insensitively." })
  ),
  literal: Type.Optional(
    Type.Boolean({ description: "Treat pattern as a literal string." })
  ),
  limit: Type.Optional(
    Type.Number({ description: `Maximum matches. Default ${DEFAULT_LIMIT}.` })
  )
});

type GrepFilesParameters = Static<typeof grepFilesParameters>;

export function createGrepFilesTool(env: ExecutionEnv): ServerPlugin.PluginTool {
  return {
    name: "grep_files",
    label: "Grep Files",
    description:
      "Search file contents using grep. Returns matching file paths, line numbers, and matched lines.",
    parameters: grepFilesParameters,
    async execute(_toolCallId, rawParams, signal) {
      const params = rawParams as GrepFilesParameters;
      const searchPath = resolveToolPath(env.cwd, params.path ?? ".");
      const limit = Math.max(1, params.limit ?? DEFAULT_LIMIT);
      const result = await runGrep(searchPath, params, limit, signal);
      const truncated = truncateText(result.lines.join("\n"));

      return {
        content: [
          {
            type: "text",
            text: truncated.text || "No matches found"
          }
        ],
        details: {
          path: searchPath,
          pattern: params.pattern,
          matchCount: result.matchCount,
          matchLimitReached: result.matchLimitReached ? limit : undefined,
          truncated: truncated.truncated
        }
      };
    }
  };
}

function runGrep(
  searchPath: string,
  params: GrepFilesParameters,
  limit: number,
  signal: AbortSignal | undefined
): Promise<{ lines: string[]; matchCount: number; matchLimitReached: boolean }> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Operation aborted"));
      return;
    }

    const args = [
      "-R",
      "-n",
      "-I",
      "--exclude-dir=.git",
      "--exclude-dir=node_modules",
      "--exclude-dir=dist"
    ];
    if (params.ignoreCase) {
      args.push("-i");
    }
    if (params.literal) {
      args.push("-F");
    }
    if (params.glob) {
      args.push("--include", params.glob);
    }
    args.push("--", params.pattern, searchPath);

    const child = spawn("grep", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const settle = (callback: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      callback();
    };

    const onAbort = (): void => {
      child.kill();
      settle(() => reject(new Error("Operation aborted")));
    };

    signal?.addEventListener("abort", onAbort, { once: true });

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      settle(() => reject(new Error(`Failed to run grep: ${error.message}`)));
    });
    child.on("close", (code) => {
      if (code !== 0 && code !== 1) {
        settle(() => reject(new Error(stderr.trim() || `grep exited with ${code}`)));
        return;
      }

      const allLines = stdout
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => formatGrepLine(searchPath, line));
      const lines = allLines.slice(0, limit);
      settle(() =>
        resolve({
          lines,
          matchCount: lines.length,
          matchLimitReached: allLines.length > limit
        })
      );
    });
  });
}

function formatGrepLine(searchPath: string, line: string): string {
  const firstColon = line.indexOf(":");
  if (firstColon === -1) {
    return line;
  }

  const secondColon = line.indexOf(":", firstColon + 1);
  if (secondColon === -1) {
    return line;
  }

  const rawPath = line.slice(0, firstColon);
  const lineNumber = line.slice(firstColon + 1, secondColon);
  const text = line.slice(secondColon + 1);
  const displayPath = toPosix(relative(searchPath, rawPath)) || rawPath;
  return `${displayPath}:${lineNumber}:${text}`;
}

function toPosix(value: string): string {
  return value.split(sep).join("/");
}
