import { readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import type { ExecutionEnv } from "@earendil-works/pi-agent-core";
import { Type, type Static } from "@earendil-works/pi-ai";
import type { ServerPlugin } from "@hold-rein/plugin-server";

import { resolveToolPath } from "./path-utils";
import { truncateText } from "./truncate";

const DEFAULT_LIMIT = 1000;
const ignoredDirectories = new Set([".git", "node_modules", "dist"]);

const findFilesParameters = Type.Object({
  pattern: Type.String({
    description:
      "Filename pattern. Supports * and ? wildcards. If it contains '/', it matches relative paths."
  }),
  path: Type.Optional(
    Type.String({ description: "Directory to search. Defaults to cwd." })
  ),
  limit: Type.Optional(
    Type.Number({ description: `Maximum results. Default ${DEFAULT_LIMIT}.` })
  )
});

type FindFilesParameters = Static<typeof findFilesParameters>;

export function createFindFilesTool(env: ExecutionEnv): ServerPlugin.PluginTool {
  return {
    name: "find_files",
    label: "Find Files",
    description:
      "Find files by filename pattern. Returns paths relative to the search directory.",
    parameters: findFilesParameters,
    async execute(_toolCallId, rawParams, signal) {
      const params = rawParams as FindFilesParameters;
      const searchPath = resolveToolPath(env.cwd, params.path ?? ".");
      const limit = Math.max(1, params.limit ?? DEFAULT_LIMIT);
      const matcher = createPatternMatcher(params.pattern);
      const results: string[] = [];

      await walkFiles(searchPath, searchPath, matcher, results, limit, signal);

      const text =
        results.length > 0 ? results.join("\n") : "No files found matching pattern";
      const truncated = truncateText(text);

      return {
        content: [{ type: "text", text: truncated.text }],
        details: {
          path: searchPath,
          pattern: params.pattern,
          resultCount: results.length,
          resultLimitReached: results.length >= limit ? limit : undefined,
          truncated: truncated.truncated
        }
      };
    }
  };
}

async function walkFiles(
  root: string,
  current: string,
  matcher: (relativePath: string, basename: string) => boolean,
  results: string[],
  limit: number,
  signal: AbortSignal | undefined
): Promise<void> {
  throwIfAborted(signal);
  if (results.length >= limit) {
    return;
  }

  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    throwIfAborted(signal);
    const absolutePath = join(current, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        await walkFiles(root, absolutePath, matcher, results, limit, signal);
      }
      if (results.length >= limit) {
        return;
      }
      continue;
    }

    if (!entry.isFile() && !(await stat(absolutePath)).isFile()) {
      continue;
    }

    const relativePath = toPosix(relative(root, absolutePath));
    if (matcher(relativePath, entry.name)) {
      results.push(relativePath);
      if (results.length >= limit) {
        return;
      }
    }
  }
}

function createPatternMatcher(
  pattern: string
): (relativePath: string, basename: string) => boolean {
  const regex = wildcardToRegExp(pattern);
  const matchRelativePath = pattern.includes("/") || pattern.includes(sep);
  return (relativePath, basename) =>
    regex.test(matchRelativePath ? relativePath : basename);
}

function wildcardToRegExp(pattern: string): RegExp {
  const source = pattern
    .split(sep)
    .join("/")
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${source}$`);
}

function toPosix(value: string): string {
  return value.split(sep).join("/");
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new Error("Operation aborted");
  }
}
