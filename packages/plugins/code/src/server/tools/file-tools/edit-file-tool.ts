import { readFile, writeFile } from "node:fs/promises";
import type { ExecutionEnv } from "@earendil-works/pi-agent-core";
import { Type, type Static } from "@earendil-works/pi-ai";
import type { ServerPlugin } from "@hold-rein/plugin-server";

import { normalizeTextLineEndings, resolveToolPath } from "./path-utils";

const editReplacementParameters = Type.Object({
  oldText: Type.String({
    description:
      "Exact original text. It must occur exactly once in the original file."
  }),
  newText: Type.String({ description: "Replacement text." })
});

const editFileParameters = Type.Object({
  path: Type.String({ description: "Path to the file to edit." }),
  oldText: Type.Optional(
    Type.String({
      description: "Legacy single replacement original text."
    })
  ),
  newText: Type.Optional(
    Type.String({ description: "Legacy single replacement text." })
  ),
  edits: Type.Optional(
    Type.Array(editReplacementParameters, {
      description:
        "One or more exact text replacements matched against the original file."
    })
  )
});

type EditFileParameters = Static<typeof editFileParameters>;

interface EditReplacement {
  oldText: string;
  newText: string;
}

interface MatchedReplacement extends EditReplacement {
  index: number;
  startLineNumber: number;
}

export function createEditFileTool(env: ExecutionEnv): ServerPlugin.PluginTool {
  return {
    name: "edit_file",
    label: "Edit File",
    description:
      "Edit a file by replacing unique original text blocks. Returns only changed blocks and a compact diff.",
    parameters: editFileParameters,
    beforeExecute({ event, requestApproval }) {
      const params = event.input as Partial<EditFileParameters>;
      return requestApproval(`Allowed to edit file: ${params.path ?? ""}`);
    },
    async execute(_toolCallId, rawParams, signal) {
      const params = rawParams as EditFileParameters;
      const replacements = normalizeReplacements(params);
      throwIfAborted(signal);

      const absolutePath = resolveToolPath(env.cwd, params.path);
      const rawContent = await readFile(absolutePath, "utf8");
      throwIfAborted(signal);

      const lineEnding = rawContent.includes("\r\n") ? "\r\n" : "\n";
      const content = normalizeTextLineEndings(rawContent);
      const matched = matchReplacements(content, replacements, params.path);
      const newContent = applyReplacements(content, matched);
      throwIfAborted(signal);

      await writeFile(absolutePath, restoreLineEndings(newContent, lineEnding), "utf8");
      throwIfAborted(signal);

      const replacementResults = matched.map(
        ({ newText, oldText, startLineNumber }) => ({
          newText,
          oldText,
          startLineNumber
        })
      );
      const diff = formatReplacementDiff(replacementResults);
      return {
        content: [
          {
            type: "text",
            text: [
              `Successfully replaced ${replacements.length} block(s) in ${params.path}.`,
              "",
              diff
            ].join("\n")
          }
        ],
        details: {
          path: absolutePath,
          replacements: replacementResults,
          diff
        }
      };
    }
  };
}

function normalizeReplacements(params: EditFileParameters): EditReplacement[] {
  const edits = Array.isArray(params.edits) ? [...params.edits] : [];
  if (typeof params.oldText === "string" && typeof params.newText === "string") {
    edits.push({ oldText: params.oldText, newText: params.newText });
  }

  if (edits.length === 0) {
    throw new Error("edit_file requires oldText/newText or at least one edits entry.");
  }

  return edits.map((edit, index) => {
    if (!edit.oldText) {
      throw new Error(`edits[${index}].oldText must not be empty.`);
    }
    return {
      oldText: normalizeTextLineEndings(edit.oldText),
      newText: normalizeTextLineEndings(edit.newText)
    };
  });
}

function matchReplacements(
  content: string,
  replacements: EditReplacement[],
  path: string
): MatchedReplacement[] {
  const matched = replacements.map((replacement, index) => {
    const occurrences = findOccurrences(content, replacement.oldText);
    if (occurrences.length === 0) {
      throw new Error(
        `Could not find edits[${index}] in ${path}. The oldText must match exactly.`
      );
    }
    if (occurrences.length > 1) {
      throw new Error(
        `Found ${occurrences.length} occurrences of edits[${index}] in ${path}. Each oldText must be unique.`
      );
    }
    const occurrenceIndex = occurrences[0];
    if (occurrenceIndex === undefined) {
      throw new Error(`Could not find edits[${index}] in ${path}.`);
    }
    return {
      ...replacement,
      index: occurrenceIndex,
      startLineNumber: content.slice(0, occurrenceIndex).split("\n").length
    };
  });

  matched.sort((a, b) => a.index - b.index);
  for (let i = 1; i < matched.length; i++) {
    const previous = matched[i - 1];
    const current = matched[i];
    if (!previous || !current) {
      continue;
    }
    if (previous.index + previous.oldText.length > current.index) {
      throw new Error("edit_file replacements must not overlap.");
    }
  }

  return matched;
}

function findOccurrences(content: string, search: string): number[] {
  const indexes: number[] = [];
  let index = content.indexOf(search);
  while (index !== -1) {
    indexes.push(index);
    index = content.indexOf(search, index + search.length);
  }
  return indexes;
}

function applyReplacements(
  content: string,
  replacements: MatchedReplacement[]
): string {
  let nextContent = content;
  for (const replacement of [...replacements].reverse()) {
    nextContent =
      nextContent.slice(0, replacement.index) +
      replacement.newText +
      nextContent.slice(replacement.index + replacement.oldText.length);
  }
  if (nextContent === content) {
    throw new Error("No changes made. The replacements produced identical content.");
  }
  return nextContent;
}

function formatReplacementDiff(
  replacements: Array<EditReplacement & { startLineNumber: number }>
): string {
  return replacements
    .map((replacement, index) =>
      [
        `@@ replacement ${index + 1}, line ${replacement.startLineNumber} @@`,
        ...replacement.oldText.split("\n").map((line) => `-${line}`),
        ...replacement.newText.split("\n").map((line) => `+${line}`)
      ].join("\n")
    )
    .join("\n");
}

function restoreLineEndings(text: string, lineEnding: "\r\n" | "\n"): string {
  return lineEnding === "\r\n" ? text.replace(/\n/g, "\r\n") : text;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new Error("Operation aborted");
  }
}
