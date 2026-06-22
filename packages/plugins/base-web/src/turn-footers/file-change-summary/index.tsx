import {
  DeleteOutlined,
  DiffOutlined,
  SaveOutlined
} from "@ant-design/icons";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { WebPlugin } from "@hold-rein/plugin-web";

import {
  CodePreview,
  DiffPreview
} from "../../tools/file-tools/code-preview";
import {
  getStringArg,
  getWorkspaceRelativePath
} from "../../tools/file-tools/utils";

import "./file-change-summary.css";

type FileOperation = "delete" | "edit" | "write";

interface CodeContent {
  text: string;
  type: "code";
}

interface DiffContent {
  modified: string;
  original: string;
  type: "diff";
}

export interface FileChangeSummaryItem {
  content?: CodeContent | DiffContent | undefined;
  operation: FileOperation;
  path: string;
}

interface EditReplacement {
  newText: string;
  oldText: string;
}

const operationLabels: Record<FileOperation, string> = {
  delete: "删除",
  edit: "编辑",
  write: "新增"
};

const operationOrder: readonly FileOperation[] = ["edit", "write", "delete"];

export function FileChangeSummaryTurnFooter({
  messages,
  workspacePath
}: WebPlugin.TurnFooterRenderProps) {
  const items = useMemo(() => getFileChangeSummaryItems(messages), [messages]);
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(
    () => new Set()
  );

  if (!items.length) {
    return null;
  }

  const counts = countOperations(items);
  const title = operationOrder
    .filter((operation) => counts[operation] > 0)
    .map(
      (operation) =>
        `${operationLabels[operation]}${counts[operation]}个文件`
    )
    .join("、");

  return (
    <section className="base-file-change-summary">
      <div className="base-file-change-summary__title">
        {title}
      </div>
      <div className="base-file-change-summary__list">
        {items.map((item, index) => {
          const itemKey = `${item.operation}:${item.path}:${index}`;
          const canExpand = item.content !== undefined;
          const isExpanded = expandedKeys.has(itemKey);

          return (
            <div className="base-file-change-summary__item" key={itemKey}>
              <FileChangeRow
                displayPath={
                  getWorkspaceRelativePath(item.path, workspacePath) ?? item.path
                }
                expanded={isExpanded}
                item={item}
                onToggle={
                  canExpand
                    ? () => {
                        setExpandedKeys((current) =>
                          toggleExpandedKey(current, itemKey)
                        );
                      }
                    : undefined
                }
              />
              {isExpanded && item.content ? (
                <div className="base-file-change-summary__preview">
                  <FileChangePreview item={item} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function getFileChangeSummaryItems(
  messages: readonly WebPlugin.AgentMessage[]
): FileChangeSummaryItem[] {
  const items: FileChangeSummaryItem[] = [];
  const failedToolCallIds = getFailedToolCallIds(messages);

  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }

    for (const block of message.content) {
      if (block.type !== "toolCall") {
        continue;
      }
      if (failedToolCallIds.has(block.id)) {
        continue;
      }

      const item = getFileChangeSummaryItem(block);
      if (item) {
        items.push(item);
      }
    }
  }

  return items;
}

function getFailedToolCallIds(
  messages: readonly WebPlugin.AgentMessage[]
): ReadonlySet<string> {
  const failedToolCallIds = new Set<string>();

  for (const message of messages) {
    if (message.role === "toolResult" && message.isError) {
      failedToolCallIds.add(message.toolCallId);
    }
  }

  return failedToolCallIds;
}

export const fileChangeSummaryTurnFooter: WebPlugin.TurnFooterRender = {
  id: "file-change-summary",
  Render: FileChangeSummaryTurnFooter
};

function FileChangeRow({
  displayPath,
  expanded,
  item,
  onToggle
}: {
  displayPath: string;
  expanded: boolean;
  item: FileChangeSummaryItem;
  onToggle?: (() => void) | undefined;
}) {
  const rowClassName = [
    "base-file-change-summary__row",
    item.operation === "delete" ? "base-file-change-summary__row--delete" : ""
  ]
    .filter(Boolean)
    .join(" ");
  const stats = getLineStats(item);
  const content = (
    <>
      <span className="base-file-change-summary__icon">
        {getOperationIcon(item.operation)}
      </span>
      <span className="base-file-change-summary__path">{displayPath}</span>
      {stats ? <LineStats stats={stats} /> : null}
    </>
  );

  if (!onToggle) {
    return <div className={rowClassName}>{content}</div>;
  }

  return (
    <button
      aria-expanded={expanded}
      className={rowClassName}
      onClick={onToggle}
      type="button"
    >
      {content}
    </button>
  );
}

function FileChangePreview({ item }: { item: FileChangeSummaryItem }) {
  if (item.content?.type === "code") {
    return <CodePreview content={item.content.text} path={item.path} />;
  }

  if (item.content?.type === "diff") {
    return (
      <DiffPreview
        modified={item.content.modified}
        original={item.content.original}
        path={item.path}
      />
    );
  }

  return null;
}

function getFileChangeSummaryItem(
  toolCall: WebPlugin.ToolCall
): FileChangeSummaryItem | undefined {
  const path = getStringArg(toolCall.arguments, "path");
  if (!path) {
    return undefined;
  }

  if (toolCall.name === "write_file") {
    return {
      content: {
        text: getStringArg(toolCall.arguments, "content") ?? "",
        type: "code"
      },
      operation: "write",
      path
    };
  }

  if (toolCall.name === "delete_file") {
    return {
      operation: "delete",
      path
    };
  }

  if (toolCall.name !== "edit_file") {
    return undefined;
  }

  const replacements = getEditReplacements(toolCall.arguments);

  return {
    content: {
      modified: replacements.map((replacement) => replacement.newText).join("\n"),
      original: replacements.map((replacement) => replacement.oldText).join("\n"),
      type: "diff"
    },
    operation: "edit",
    path
  };
}

function getEditReplacements(
  args: Record<string, unknown>
): EditReplacement[] {
  const replacements: EditReplacement[] = [];
  const oldText = getStringArg(args, "oldText");
  const newText = getStringArg(args, "newText");

  if (oldText !== undefined && newText !== undefined) {
    replacements.push({ newText, oldText });
  }

  if (!Array.isArray(args.edits)) {
    return replacements;
  }

  for (const edit of args.edits) {
    if (!edit || typeof edit !== "object") {
      continue;
    }

    const candidate = edit as Record<string, unknown>;
    if (
      typeof candidate.newText === "string" &&
      typeof candidate.oldText === "string"
    ) {
      replacements.push({
        newText: candidate.newText,
        oldText: candidate.oldText
      });
    }
  }

  return replacements;
}

function countOperations(
  items: readonly FileChangeSummaryItem[]
): Record<FileOperation, number> {
  return items.reduce<Record<FileOperation, number>>(
    (counts, item) => ({
      ...counts,
      [item.operation]: counts[item.operation] + 1
    }),
    { delete: 0, edit: 0, write: 0 }
  );
}

function LineStats({
  stats
}: {
  stats: { added: number; removed: number };
}) {
  return (
    <span
      aria-label={`新增 ${stats.added} 行，删除 ${stats.removed} 行`}
      className="base-file-change-summary__stats"
    >
      <span className="base-file-change-summary__stat base-file-change-summary__stat--added">
        +{stats.added}
      </span>
      {stats.removed > 0 ? (
        <span className="base-file-change-summary__stat base-file-change-summary__stat--removed">
          -{stats.removed}
        </span>
      ) : null}
    </span>
  );
}

function getLineStats(
  item: FileChangeSummaryItem
): { added: number; removed: number } | undefined {
  if (item.content?.type === "code") {
    return { added: countTextLines(item.content.text), removed: 0 };
  }

  if (item.content?.type === "diff") {
    return {
      added: countTextLines(item.content.modified),
      removed: countTextLines(item.content.original)
    };
  }

  return undefined;
}

function countTextLines(text: string): number {
  const normalized = text.replace(/\n$/, "");
  if (!normalized) {
    return 0;
  }
  return normalized.split("\n").length;
}

function getOperationIcon(operation: FileOperation): ReactNode {
  if (operation === "edit") {
    return <DiffOutlined />;
  }
  if (operation === "write") {
    return <SaveOutlined />;
  }
  return <DeleteOutlined />;
}

function toggleExpandedKey(
  current: ReadonlySet<string>,
  key: string
): ReadonlySet<string> {
  const next = new Set(current);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  return next;
}
