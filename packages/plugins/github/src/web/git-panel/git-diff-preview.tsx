import { DiffEditor } from "@monaco-editor/react";
import { Spin } from "antd";
import { type ReactElement, Suspense, useEffect, useState } from "react";

type FileDiffState =
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "loaded"; readonly diff: string }
  | { readonly status: "loading" };

const LANGUAGE_BY_EXTENSION: Readonly<Record<string, string>> = {
  c: "c",
  cpp: "cpp",
  cs: "csharp",
  css: "css",
  go: "go",
  html: "html",
  java: "java",
  js: "javascript",
  json: "json",
  jsx: "javascript",
  md: "markdown",
  py: "python",
  rs: "rust",
  sh: "shell",
  sql: "sql",
  ts: "typescript",
  tsx: "typescript",
  txt: "plaintext",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml"
};

export type { FileDiffState };

export function GitFileDiffPreview({
  diffState,
  filePath,
  monacoTheme
}: {
  readonly diffState: FileDiffState | undefined;
  readonly filePath: string;
  readonly monacoTheme: "vs" | "vs-dark";
}): ReactElement {
  if (!diffState || diffState.status === "loading") {
    return <div className="git-panel__diff-state"><Spin size="small" /></div>;
  }

  if (diffState.status === "error") {
    return (
      <div className="git-panel__diff-alert" role="alert">
        {diffState.message}
      </div>
    );
  }

  const content = parseUnifiedDiff(diffState.diff);
  const height = Math.min(
    420,
    Math.max(
      180,
      Math.max(
        content.original.split("\n").length,
        content.modified.split("\n").length
      ) * 22
    )
  );

  return (
    <div className="git-panel__diff">
      <Suspense fallback={<pre className="git-panel__diff-pre">{content.modified}</pre>}>
        <DiffEditor
          height={height}
          language={getLanguageFromPath(filePath)}
          modified={content.modified}
          options={{
            lineNumbersMinChars: 3,
            minimap: { enabled: false },
            readOnly: true,
            renderSideBySide: false,
            scrollBeyondLastLine: false,
            wordWrap: "on"
          }}
          original={content.original}
          theme={monacoTheme}
        />
      </Suspense>
    </div>
  );
}

export function useMonacoTheme(): "vs" | "vs-dark" {
  const [theme, setTheme] = useState<"vs" | "vs-dark">(() =>
    document.documentElement.dataset.themeMode === "dark" ? "vs-dark" : "vs"
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(
        document.documentElement.dataset.themeMode === "dark" ? "vs-dark" : "vs"
      );
    });

    observer.observe(document.documentElement, {
      attributeFilter: ["data-theme-mode"]
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return theme;
}

function parseUnifiedDiff(
  diff: string
): { readonly modified: string; readonly original: string } {
  const original: string[] = [];
  const modified: string[] = [];
  let insideHunk = false;

  for (const line of diff.split(/\r?\n/u)) {
    if (line.startsWith("@@")) {
      insideHunk = true;
      continue;
    }

    if (!insideHunk || line.startsWith("\\ No newline")) {
      continue;
    }

    if (line.startsWith("+")) {
      modified.push(line.slice(1));
      continue;
    }

    if (line.startsWith("-")) {
      original.push(line.slice(1));
      continue;
    }

    if (line.startsWith(" ")) {
      const contextLine = line.slice(1);
      original.push(contextLine);
      modified.push(contextLine);
    }
  }

  if (!original.length && !modified.length && diff.trim()) {
    return { modified: diff, original: "" };
  }

  return {
    modified: modified.join("\n"),
    original: original.join("\n")
  };
}

function getLanguageFromPath(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();
  return extension ? LANGUAGE_BY_EXTENSION[extension] ?? "plaintext" : "plaintext";
}
