import { Input, Modal, Typography } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAppUi } from "../../../app/app-ui-context";
import { useAppWorkspace } from "../../../app/app-workspace-context";
import type { FileSystemEntry } from "../../../components/fileSelector";
import {
  createDirectory,
  deleteFileSystemEntry,
  downloadFile,
  fetchDirectoryEntries,
  fetchFileContent,
  uploadFilesToDirectory
} from "./workspace-file-tree-api";
import {
  WorkspaceFileTreeEntry,
  type OpenFileState
} from "./workspace-file-tree-entry";

import "./workspace-file-tree.css";

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
  const [folderDialogParent, setFolderDialogParent] =
    useState<FileSystemEntry | null>(null);
  const [folderName, setFolderName] = useState("");
  const [createFolderError, setCreateFolderError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileSystemEntry | null>(null);
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

  const refreshDirectory = useCallback(
    async (directoryPath: string) => {
      const listing = await fetchDirectoryEntries(directoryPath);

      setEntries((currentEntries) => {
        if (activeWorkspace?.path === directoryPath) {
          return listing.entries;
        }

        return updateEntryChildren(currentEntries, directoryPath, listing.entries);
      });
    },
    [activeWorkspace?.path]
  );

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

      void refreshDirectory(entry.path)
        .then(expandFolder)
        .catch(() => undefined);
    },
    [expandedPaths, refreshDirectory]
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

  const handleCreateFolder = useCallback(() => {
    const parentPath = folderDialogParent?.path;
    const name = folderName.trim();

    if (!parentPath || !name) {
      return;
    }

    const parentChildren =
      findEntryByPath(entries, parentPath)?.children ?? folderDialogParent?.children;
    const hasSameNameFolder = parentChildren?.some(
      (entry) => entry.kind === "folder" && entry.name === name
    );

    if (hasSameNameFolder) {
      setCreateFolderError("当前目录已存在同名文件夹");
      return;
    }

    void createDirectory(parentPath, name)
      .then(() => refreshDirectory(parentPath))
      .then(() => {
        setExpandedPaths((currentPaths) => new Set(currentPaths).add(parentPath));
        setFolderDialogParent(null);
        setFolderName("");
        setCreateFolderError(null);
      })
      .catch(() => undefined);
  }, [entries, folderDialogParent, folderName, refreshDirectory]);

  const openCreateFolderDialog = useCallback(
    (entry: FileSystemEntry) => {
      const openDialog = (parentEntry: FileSystemEntry) => {
        setFolderDialogParent(parentEntry);
        setFolderName("");
        setCreateFolderError(null);
      };

      if (entry.children) {
        openDialog(entry);
        return;
      }

      void fetchDirectoryEntries(entry.path)
        .then((listing) => {
          const parentEntry = {
            ...entry,
            children: listing.entries
          };

          setEntries((currentEntries) =>
            updateEntryChildren(currentEntries, entry.path, listing.entries)
          );
          openDialog(parentEntry);
        })
        .catch(() => undefined);
    },
    []
  );

  const handleUploadFiles = useCallback(
    (entry: FileSystemEntry, fileList: FileList | null) => {
      const files = Array.from(fileList ?? []);

      if (files.length === 0) {
        return;
      }

      void uploadFilesToDirectory(entry.path, files)
        .then(() => refreshDirectory(entry.path))
        .then(() => {
          setExpandedPaths((currentPaths) => new Set(currentPaths).add(entry.path));
        })
        .catch(() => undefined);
    },
    [refreshDirectory]
  );

  const handleDeleteEntry = useCallback(() => {
    if (!deleteTarget) {
      return;
    }

    const parentPath = getParentPath(deleteTarget.path);

    void deleteFileSystemEntry(deleteTarget.path)
      .then(() => {
        if (openFile?.path === deleteTarget.path) {
          setOpenFile(null);
        }

        setDeleteTarget(null);
        return refreshDirectory(parentPath);
      })
      .catch(() => undefined);
  }, [deleteTarget, openFile?.path, refreshDirectory]);

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
              onCreateFolder={openCreateFolderDialog}
              onDeleteEntry={setDeleteTarget}
              onDownloadFile={(entry) => {
                void downloadFile(entry.path).catch(() => undefined);
              }}
              onUploadFiles={handleUploadFiles}
              supportedLanguage={getSupportedLanguage}
            />
          ))}
        </div>
      ) : null}
      <Modal
        cancelText="取消"
        okButtonProps={{
          "aria-label": "确定",
          disabled: folderName.trim().length === 0
        }}
        okText="确定"
        onCancel={() => {
          setFolderDialogParent(null);
          setCreateFolderError(null);
        }}
        onOk={handleCreateFolder}
        open={folderDialogParent !== null}
        title="新建文件夹"
      >
        <label className="workspace-file-tree__field">
          <span>文件夹名称</span>
          <Input
            aria-label="文件夹名称"
            autoFocus
            value={folderName}
            onChange={(event) => {
              setFolderName(event.target.value);
              setCreateFolderError(null);
            }}
            onPressEnter={handleCreateFolder}
            {...(createFolderError ? { status: "error" as const } : {})}
          />
          {createFolderError ? (
            <Typography.Text type="danger">{createFolderError}</Typography.Text>
          ) : null}
        </label>
      </Modal>
      <Modal
        cancelText="取消"
        okButtonProps={{ "aria-label": "确定" }}
        okText="确定"
        onCancel={() => setDeleteTarget(null)}
        onOk={handleDeleteEntry}
        open={deleteTarget !== null}
        title="删除确认"
      >
        确定删除 {deleteTarget?.name} 吗？
      </Modal>
    </section>
  );
}

function getParentPath(entryPath: string): string {
  const separatorIndex = entryPath.lastIndexOf("/");

  return separatorIndex <= 0 ? "/" : entryPath.slice(0, separatorIndex);
}

function getSupportedLanguage(entry: FileSystemEntry): string | undefined {
  return SUPPORTED_LANGUAGES[entry.extension.toLowerCase()];
}

function findEntryByPath(
  entries: FileSystemEntry[],
  path: string
): FileSystemEntry | undefined {
  for (const entry of entries) {
    if (entry.path === path) {
      return entry;
    }

    const childEntry = entry.children
      ? findEntryByPath(entry.children, path)
      : undefined;

    if (childEntry) {
      return childEntry;
    }
  }

  return undefined;
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
