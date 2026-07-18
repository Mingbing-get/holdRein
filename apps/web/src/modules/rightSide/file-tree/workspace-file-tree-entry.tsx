import {
  DeleteOutlined,
  DownloadOutlined,
  FileOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  PlusOutlined,
  UploadOutlined
} from "@ant-design/icons";
import { Button } from "antd";
import { lazy, Suspense } from "react";

import type { FileSystemEntry } from "../../../components/fileSelector";

const INDENT_WIDTH = 16;
const BASE_INDENT = 8;
const Editor = lazy(() => import("@monaco-editor/react"));

export interface OpenFileState {
  content: string;
  language: string;
  path: string;
}

export interface WorkspaceFileTreeEntryProps {
  entry: FileSystemEntry;
  expandedPaths: Set<string>;
  level: number;
  monacoTheme: string;
  onCreateFolder: (entry: FileSystemEntry) => void;
  onDeleteEntry: (entry: FileSystemEntry) => void;
  onDownloadFile: (entry: FileSystemEntry) => void;
  onToggleFile: (entry: FileSystemEntry) => void;
  onToggleFolder: (entry: FileSystemEntry) => void;
  onUploadFiles: (entry: FileSystemEntry, files: FileList | null) => void;
  openFile: OpenFileState | null;
  supportedLanguage: (entry: FileSystemEntry) => string | undefined;
}

export function WorkspaceFileTreeEntry({
  entry,
  expandedPaths,
  level,
  monacoTheme,
  onCreateFolder,
  onDeleteEntry,
  onDownloadFile,
  onToggleFile,
  onToggleFolder,
  onUploadFiles,
  openFile,
  supportedLanguage
}: WorkspaceFileTreeEntryProps) {
  const isFolder = entry.kind === "folder";
  const isExpanded = expandedPaths.has(entry.path);
  const isSelected = openFile?.path === entry.path;
  const isSupported = isFolder || Boolean(supportedLanguage(entry));
  const rowClassName = [
    "workspace-file-tree__row",
    isSelected ? "workspace-file-tree__row--selected" : undefined,
    !isSupported ? "workspace-file-tree__row--unsupported" : undefined
  ].filter(Boolean).join(" ");
  const toggleEntry = () => {
    if (isFolder) {
      onToggleFolder(entry);
      return;
    }

    onToggleFile(entry);
  };

  return (
    <>
      <div
        aria-expanded={isFolder ? isExpanded : undefined}
        aria-label={entry.name}
        aria-selected={!isFolder ? isSelected : undefined}
        className={rowClassName}
        onClick={toggleEntry}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleEntry();
          }
        }}
        role="treeitem"
        style={{ paddingLeft: BASE_INDENT + level * INDENT_WIDTH }}
        tabIndex={0}
      >
        <span className="workspace-file-tree__row-icon">
          {getEntryIcon(entry, isExpanded)}
        </span>
        <span className="workspace-file-tree__row-name">{entry.name}</span>
        <WorkspaceFileTreeEntryActions
          entry={entry}
          onCreateFolder={onCreateFolder}
          onDeleteEntry={onDeleteEntry}
          onDownloadFile={onDownloadFile}
          onUploadFiles={onUploadFiles}
        />
      </div>
      {isFolder && isExpanded
        ? entry.children?.map((childEntry) => (
            <WorkspaceFileTreeEntry
              entry={childEntry}
              expandedPaths={expandedPaths}
              key={childEntry.path}
              level={level + 1}
              monacoTheme={monacoTheme}
              openFile={openFile}
              onCreateFolder={onCreateFolder}
              onDeleteEntry={onDeleteEntry}
              onDownloadFile={onDownloadFile}
              onToggleFile={onToggleFile}
              onToggleFolder={onToggleFolder}
              onUploadFiles={onUploadFiles}
              supportedLanguage={supportedLanguage}
            />
          ))
        : null}
      {isSelected ? (
        <div className="workspace-file-tree__editor">
          <Suspense fallback={<div className="workspace-file-tree__state">加载文件中...</div>}>
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

function WorkspaceFileTreeEntryActions({
  entry,
  onCreateFolder,
  onDeleteEntry,
  onDownloadFile,
  onUploadFiles
}: Pick<
  WorkspaceFileTreeEntryProps,
  "entry" | "onCreateFolder" | "onDeleteEntry" | "onDownloadFile" | "onUploadFiles"
>) {
  const isFolder = entry.kind === "folder";

  return (
    <span className="workspace-file-tree__row-actions">
      {isFolder ? (
        <>
          <Button
            aria-label={`在 ${entry.name} 下新建文件夹`}
            className="workspace-file-tree__action--normal"
            icon={<PlusOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              onCreateFolder(entry);
            }}
            size="small"
            type="text"
          />
          <label
            className="workspace-file-tree__upload workspace-file-tree__action--normal"
            onClick={(event) => event.stopPropagation()}
            title={`上传文件到 ${entry.name}`}
          >
            <UploadOutlined aria-hidden="true" />
            <input
              aria-label={`上传文件到 ${entry.name}`}
              multiple
              type="file"
              onChange={(event) => {
                onUploadFiles(entry, event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        </>
      ) : (
        <Button
          aria-label={`下载 ${entry.name}`}
          className="workspace-file-tree__action--normal"
          icon={<DownloadOutlined />}
          onClick={(event) => {
            event.stopPropagation();
            onDownloadFile(entry);
          }}
          size="small"
          type="text"
        />
      )}
      <Button
        aria-label={`删除 ${entry.name}`}
        className="workspace-file-tree__action--danger"
        icon={<DeleteOutlined />}
        onClick={(event) => {
          event.stopPropagation();
          onDeleteEntry(entry);
        }}
        size="small"
        type="text"
      />
    </span>
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
