import {
  DiffOutlined,
  DeleteOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  ReadOutlined,
  SaveOutlined,
  SearchOutlined
} from "@ant-design/icons";
import type { WebPlugin } from "@hold-rein/plugin-web";

import { CodePreview, DiffPreview } from "./code-preview";
import {
  getStringArg,
  getTextResult,
  getWorkspaceRelativePath,
  splitResultLines
} from "./utils";

import "./file-tool-render.css";

interface EditReplacement {
  oldText: string;
  newText: string;
}

export function ReadFileToolRender(props: WebPlugin.ToolRenderProps) {
  const args = props.toolCall.arguments;
  const path = getStringArg(args, "path");
  const output = getTextResult(props.result);

  return (
    <props.DefaultToolRender title="读取文件" icon={<ReadOutlined />}>
      <div className="base-file-tool">
        <ToolMeta path={path} workspacePath={props.workspacePath} />
        {output ? (
          <CodePreview content={output} path={path} />
        ) : (
          <span className="base-file-tool__empty">等待读取结果</span>
        )}
      </div>
    </props.DefaultToolRender>
  );
}

export function WriteFileToolRender(props: WebPlugin.ToolRenderProps) {
  const args = props.toolCall.arguments;
  const path = getStringArg(args, "path");
  const content = getStringArg(args, "content") ?? "";
  const errorOutput = props.result?.isError ? getTextResult(props.result) : "";

  return (
    <props.DefaultToolRender title="写入文件" icon={<SaveOutlined />}>
      <div className="base-file-tool">
        <ToolMeta path={path} workspacePath={props.workspacePath} />
        {content ? (
          <CodePreview content={content} path={path} />
        ) : (
          <span className="base-file-tool__empty">无写入内容</span>
        )}
        {errorOutput ? (
          <pre className="base-file-tool__pre">{errorOutput}</pre>
        ) : null}
      </div>
    </props.DefaultToolRender>
  );
}

export function DeleteFileToolRender(props: WebPlugin.ToolRenderProps) {
  const args = props.toolCall.arguments;
  const path = getStringArg(args, "path");
  const errorOutput = props.result?.isError ? getTextResult(props.result) : "";

  return (
    <props.DefaultToolRender title="删除文件" icon={<DeleteOutlined />}>
      <div className="base-file-tool">
        <ToolMeta path={path} workspacePath={props.workspacePath} />
        {!props.result ? (
          <span className="base-file-tool__empty">等待删除结果</span>
        ) : null}
        {errorOutput ? (
          <pre className="base-file-tool__pre">{errorOutput}</pre>
        ) : null}
      </div>
    </props.DefaultToolRender>
  );
}

export function GrepFilesToolRender(props: WebPlugin.ToolRenderProps) {
  const args = props.toolCall.arguments;
  const pattern = getStringArg(args, "pattern");
  const path = getStringArg(args, "path") ?? ".";
  const lines = splitResultLines(getTextResult(props.result));

  return (
    <props.DefaultToolRender title="按内容查找" icon={<SearchOutlined />}>
      <div className="base-file-tool">
        <ToolMeta path={path} pattern={pattern} workspacePath={props.workspacePath} />
        <ResultList emptyText="等待 grep 结果" lines={lines} />
      </div>
    </props.DefaultToolRender>
  );
}

export function FindFilesToolRender(props: WebPlugin.ToolRenderProps) {
  const args = props.toolCall.arguments;
  const pattern = getStringArg(args, "pattern");
  const path = getStringArg(args, "path") ?? ".";
  const lines = splitResultLines(getTextResult(props.result));

  return (
    <props.DefaultToolRender title="按文件名查找" icon={<FileSearchOutlined />}>
      <div className="base-file-tool">
        <ToolMeta path={path} pattern={pattern} workspacePath={props.workspacePath} />
        <ResultList emptyText="等待查找结果" lines={lines} />
      </div>
    </props.DefaultToolRender>
  );
}

export function EditFileToolRender(props: WebPlugin.ToolRenderProps) {
  const args = props.toolCall.arguments;
  const path = getStringArg(args, "path");
  const replacements = getEditReplacements(args);
  const errorOutput = props.result?.isError ? getTextResult(props.result) : "";

  return (
    <props.DefaultToolRender title="编辑文件" icon={<DiffOutlined />}>
      <div className="base-file-tool">
        <ToolMeta path={path} workspacePath={props.workspacePath} />
        {replacements.length ? (
          replacements.map((replacement, index) => (
            <DiffPreview
              key={`${index}-${replacement.oldText}`}
              modified={replacement.newText}
              original={replacement.oldText}
              path={path}
            />
          ))
        ) : (
          <span className="base-file-tool__empty">无可预览的替换内容</span>
        )}
        {errorOutput ? (
          <pre className="base-file-tool__pre">{errorOutput}</pre>
        ) : null}
      </div>
    </props.DefaultToolRender>
  );
}

function ToolMeta({
  path,
  pattern,
  workspacePath
}: {
  path: string | undefined;
  pattern?: string | undefined;
  workspacePath?: string | undefined;
}) {
  const displayPath = getWorkspaceRelativePath(path, workspacePath);

  return (
    <div className="base-file-tool__meta">
      {displayPath ? (
        <span className="base-file-tool__chip">
          <FileTextOutlined /> {displayPath}
        </span>
      ) : null}
      {pattern ? (
        <span className="base-file-tool__chip">pattern: {pattern}</span>
      ) : null}
    </div>
  );
}

function ResultList({
  emptyText,
  lines
}: {
  emptyText: string;
  lines: string[];
}) {
  if (!lines.length) {
    return <span className="base-file-tool__empty">{emptyText}</span>;
  }

  return (
    <ul className="base-file-tool__list">
      {lines.map((line, index) => (
        <li className="base-file-tool__list-item" key={`${index}-${line}`}>
          {line}
        </li>
      ))}
    </ul>
  );
}

function getEditReplacements(
  args: Record<string, unknown>
): EditReplacement[] {
  const oldText = getStringArg(args, "oldText");
  const newText = getStringArg(args, "newText");
  const replacements: EditReplacement[] = [];

  if (oldText !== undefined && newText !== undefined) {
    replacements.push({ oldText, newText });
  }

  const edits = args.edits;
  if (!Array.isArray(edits)) {
    return replacements;
  }

  for (const edit of edits) {
    if (!edit || typeof edit !== "object") {
      continue;
    }

    const candidate = edit as Record<string, unknown>;
    if (
      typeof candidate.oldText === "string" &&
      typeof candidate.newText === "string"
    ) {
      replacements.push({
        oldText: candidate.oldText,
        newText: candidate.newText
      });
    }
  }

  return replacements;
}

export const readFileTool: WebPlugin.ToolRender = {
  Render: ReadFileToolRender,
  toolName: "read_file"
};

export const writeFileTool: WebPlugin.ToolRender = {
  Render: WriteFileToolRender,
  toolName: "write_file"
};

export const deleteFileTool: WebPlugin.ToolRender = {
  Render: DeleteFileToolRender,
  toolName: "delete_file"
};

export const grepFilesTool: WebPlugin.ToolRender = {
  Render: GrepFilesToolRender,
  toolName: "grep_files"
};

export const findFilesTool: WebPlugin.ToolRender = {
  Render: FindFilesToolRender,
  toolName: "find_files"
};

export const editFileTool: WebPlugin.ToolRender = {
  Render: EditFileToolRender,
  toolName: "edit_file"
};
