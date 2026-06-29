import Editor, { DiffEditor } from "@monaco-editor/react";
import { Suspense } from "react";

import { getLanguageFromPath } from "./language";
import { useMonacoTheme } from "./utils";

interface CodePreviewProps {
  content: string;
  path: string | undefined;
}

interface DiffPreviewProps {
  modified: string;
  original: string;
  path: string | undefined;
}

export function CodePreview({ content, path }: CodePreviewProps) {
  const theme = useMonacoTheme();

  return (
    <div className="base-file-tool__editor">
      <Suspense fallback={<pre className="base-file-tool__pre">{content}</pre>}>
        <Editor
          height={Math.min(420, Math.max(160, content.split("\n").length * 20))}
          language={getLanguageFromPath(path)}
          options={{
            lineNumbersMinChars: 3,
            minimap: { enabled: false },
            readOnly: true,
            scrollBeyondLastLine: false,
            wordWrap: "on"
          }}
          theme={theme}
          value={content}
        />
      </Suspense>
    </div>
  );
}

export function DiffPreview({ modified, original, path }: DiffPreviewProps) {
  const theme = useMonacoTheme();
  const height = Math.min(
    420,
    Math.max(
      180,
      Math.max(original.split("\n").length, modified.split("\n").length) * 22
    )
  );

  return (
    <div className="base-file-tool__editor">
      <Suspense fallback={<pre className="base-file-tool__pre">{modified}</pre>}>
        <DiffEditor
          height={height}
          language={getLanguageFromPath(path)}
          modified={modified}
          options={{
            lineNumbersMinChars: 3,
            minimap: { enabled: false },
            readOnly: true,
            renderSideBySide: false,
            scrollBeyondLastLine: false,
            wordWrap: "on"
          }}
          original={original}
          theme={theme}
        />
      </Suspense>
    </div>
  );
}
