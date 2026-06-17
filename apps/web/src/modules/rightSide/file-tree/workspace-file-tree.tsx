import {
  FileOutlined,
  FolderOpenOutlined,
  FolderOutlined
} from "@ant-design/icons";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { useAppUi } from "../../../app/app-ui-context";
import { useAppWorkspace } from "../../../app/app-workspace-context";
import type { FileSystemEntry } from "../../../components/fileSelector";
import {
  fetchDirectoryEntries,
  fetchFileContent,
} from "./workspace-file-tree-api";

import "./workspace-file-tree.css";

const INDENT_WIDTH = 16;
const BASE_INDENT = 8;
const Editor = lazy(() => import("@monaco-editor/react"));

const SUPPORTED_LANGUAGES: Readonly<Record<string, string>> = {
  ".c": "c",
  ".cpp": "cpp",
  ".cs": "csharp",
  ".css": "css",
  ".go": "go",
  ".html": "html",
  ".java": "java",
  ".js": "javascript",
  ".json": "json",
  ".jsx": "javascript",
  ".md": "markdown",
  ".py": "python",
  ".rs": "rust",
  ".sh": "shell",
  ".sql": "sql",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".txt": "plaintext",
  ".xml": "xml",
  ".yaml": "yaml",
  ".yml": "yaml"
};

interface OpenFileState {
  content: string;
  language: string;
  path: string;
}

export function WorkspaceFileTree() {
  const {
    state: { themeMode }
  } = useAppUi();
  const {
    state: { activeWorkspaceId, workspaces }
  } = useAppWorkspace();
  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId),
    [activeWorkspaceId, workspaces]
  );
  const monacoTheme = themeMode === "dark" ? "vs-dark" : "vs";
  const [entries, setEntries] = useState<FileSystemEntry[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set()
  );
  const [openFile, setOpenFile] = useState<OpenFileState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const workspacePath = activeWorkspace?.path;

    setExpandedPaths(new Set());
    setOpenFile(null);

    if (!workspacePath) {
      setEntries([]);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    void fetchDirectoryEntries(workspacePath)
      .then((listing) => {
        if (active) {
          setEntries(listing.entries);
        }
      })
      .catch(() => {
        if (active) {
          setEntries([]);
          setError("目录加载失败");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [activeWorkspace?.path]);

  const toggleFolder = useCallback(
    (entry: FileSystemEntry) => {
      if (expandedPaths.has(entry.path)) {
        setExpandedPaths((currentPaths) => {
          const nextPaths = new Set(currentPaths);
          nextPaths.delete(entry.path);
          return nextPaths;
        });
        return;
      }

      const expandFolder = () => {
        setExpandedPaths((currentPaths) => new Set(currentPaths).add(entry.path));
      };

      if (entry.children) {
        expandFolder();
        return;
      }

      void fetchDirectoryEntries(entry.path)
        .then((listing) => {
          setEntries((currentEntries) =>
            updateEntryChildren(currentEntries, entry.path, listing.entries)
          );
          expandFolder();
        })
        .catch(() => undefined);
    },
    [expandedPaths]
  );

  const toggleFile = useCallback(
    (entry: FileSystemEntry) => {
      const language = getSupportedLanguage(entry);

      if (!language) {
        return;
      }

      if (openFile?.path === entry.path) {
        setOpenFile(null);
        return;
      }

      void fetchFileContent(entry.path)
        .then((fileContent) => {
          setOpenFile({
            content: fileContent.content,
            language,
            path: fileContent.filePath
          });
        })
        .catch(() => undefined);
    },
    [openFile?.path]
  );

  return (
    <section aria-label="Workspace file tree" className="workspace-file-tree">
      {loading ? (
        <div className="workspace-file-tree__state">加载中...</div>
      ) : null}
      {!loading && error ? (
        <div className="workspace-file-tree__state">{error}</div>
      ) : null}
      {!loading && !error && !activeWorkspace ? (
        <div className="workspace-file-tree__state">未选择工作空间</div>
      ) : null}
      {!loading && !error && activeWorkspace && entries.length === 0 ? (
        <div className="workspace-file-tree__state">当前工作空间为空</div>
      ) : null}
      {!loading && !error && entries.length ? (
        <div className="workspace-file-tree__list" role="tree">
          {entries.map((entry) => (
            <WorkspaceFileTreeEntry
              entry={entry}
              expandedPaths={expandedPaths}
              key={entry.path}
              level={0}
              monacoTheme={monacoTheme}
              openFile={openFile}
              onToggleFile={toggleFile}
              onToggleFolder={toggleFolder}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

interface WorkspaceFileTreeEntryProps {
  entry: FileSystemEntry;
  expandedPaths: Set<string>;
  level: number;
  monacoTheme: string;
  onToggleFile: (entry: FileSystemEntry) => void;
  onToggleFolder: (entry: FileSystemEntry) => void;
  openFile: OpenFileState | null;
}

function WorkspaceFileTreeEntry({
  entry,
  expandedPaths,
  level,
  monacoTheme,
  onToggleFile,
  onToggleFolder,
  openFile
}: WorkspaceFileTreeEntryProps) {
  const isFolder = entry.kind === "folder";
  const isExpanded = expandedPaths.has(entry.path);
  const isSelected = openFile?.path === entry.path;
  const isSupported = isFolder || Boolean(getSupportedLanguage(entry));
  const rowClassName = [
    "workspace-file-tree__row",
    isSelected ? "workspace-file-tree__row--selected" : undefined,
    !isSupported ? "workspace-file-tree__row--unsupported" : undefined
  ].filter(Boolean).join(" ");

  return (
    <>
      <button
        aria-expanded={isFolder ? isExpanded : undefined}
        aria-selected={!isFolder ? isSelected : undefined}
        className={rowClassName}
        onClick={() => {
          if (isFolder) {
            onToggleFolder(entry);
            return;
          }

          onToggleFile(entry);
        }}
        role="treeitem"
        style={{ paddingLeft: BASE_INDENT + level * INDENT_WIDTH }}
        type="button"
      >
        <span className="workspace-file-tree__row-icon">
          {getEntryIcon(entry, isExpanded)}
        </span>
        <span className="workspace-file-tree__row-name">{entry.name}</span>
      </button>
      {isFolder && isExpanded
        ? entry.children?.map((childEntry) => (
            <WorkspaceFileTreeEntry
              entry={childEntry}
              expandedPaths={expandedPaths}
              key={childEntry.path}
              level={level + 1}
              monacoTheme={monacoTheme}
              openFile={openFile}
              onToggleFile={onToggleFile}
              onToggleFolder={onToggleFolder}
            />
          ))
        : null}
      {isSelected ? (
        <div className="workspace-file-tree__editor">
          <Suspense
            fallback={
              <div className="workspace-file-tree__state">加载文件中...</div>
            }
          >
            <Editor
              height="100%"
              language={openFile.language}
              options={{
                lineNumbers: "on",
                minimap: { enabled: false },
                readOnly: true,
                scrollBeyondLastLine: false
              }}
              theme={monacoTheme}
              value={openFile.content}
            />
          </Suspense>
        </div>
      ) : null}
    </>
  );
}

function getEntryIcon(entry: FileSystemEntry, isExpanded: boolean) {
  if (entry.kind !== "folder") {
    return <FileOutlined aria-hidden="true" />;
  }

  return isExpanded
    ? <FolderOpenOutlined aria-hidden="true" />
    : <FolderOutlined aria-hidden="true" />;
}

function getSupportedLanguage(entry: FileSystemEntry): string | undefined {
  return SUPPORTED_LANGUAGES[entry.extension.toLowerCase()];
}

function updateEntryChildren(
  entries: FileSystemEntry[],
  path: string,
  children: FileSystemEntry[]
): FileSystemEntry[] {
  return entries.map((entry) => {
    if (entry.path === path) {
      return {
        ...entry,
        children
      };
    }

    if (!entry.children) {
      return entry;
    }

    return {
      ...entry,
      children: updateEntryChildren(entry.children, path, children)
    };
  });
}
