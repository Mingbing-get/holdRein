import {
  CheckOutlined,
  DeleteOutlined,
  FileOutlined,
  FolderOpenOutlined,
  FolderOutlined
} from "@ant-design/icons";
import { Button, Popconfirm, Tooltip } from "antd";

import type { FileSystemEntry } from "./file-selector-types";

export interface FileSelectorEntryProps {
  deleting: boolean;
  entry: FileSystemEntry;
  isSelectable: boolean;
  isSelected: boolean;
  onDelete: (entry: FileSystemEntry) => void;
  onOpenFolder: (path: string) => void;
  onToggleSelection: (entry: FileSystemEntry) => void;
}

export function FileSelectorEntry({
  deleting,
  entry,
  isSelectable,
  isSelected,
  onDelete,
  onOpenFolder,
  onToggleSelection
}: FileSelectorEntryProps) {
  const isFolder = entry.kind === "folder";
  const entryLabel = `${entry.name} ${entry.kind} ${
    isFolder ? "open" : isSelectable ? "selectable" : "unavailable"
  }`;

  return (
    <div
      aria-disabled={!isSelectable}
      aria-selected={isSelected}
      className="file-selector__entry"
      data-testid={`file-selector-entry-${entry.name}`}
    >
      <Button
        aria-label={entryLabel}
        className="file-selector__entry-main"
        disabled={deleting || (!isFolder && !isSelectable)}
        icon={isFolder ? <FolderOutlined /> : <FileOutlined />}
        onClick={() => {
          if (isFolder) {
            onOpenFolder(entry.path);
            return;
          }

          if (isSelectable) {
            onToggleSelection(entry);
          }
        }}
        type="text"
      >
        <span className="file-selector__entry-name">{entry.name}</span>
      </Button>
      <div className="file-selector__entry-actions">
        {isFolder && isSelectable ? (
          <Tooltip title="选择文件夹">
            <Button
              aria-label={`${entry.name} folder selectable`}
              className={[
                "file-selector__select-folder-button",
                isSelected
                  ? "file-selector__select-folder-button--selected"
                  : undefined
              ].filter(Boolean).join(" ")}
              disabled={deleting}
              icon={<CheckOutlined />}
              onClick={() => {
                onToggleSelection(entry);
              }}
              shape="circle"
              size="small"
              type="text"
            />
          </Tooltip>
        ) : null}
        {isFolder && !isSelectable ? <FolderOpenOutlined aria-hidden="true" /> : null}
        {!isFolder && isSelected ? <CheckOutlined aria-hidden="true" /> : null}
        <Popconfirm
          cancelText="取消"
          okButtonProps={{ danger: true, loading: deleting }}
          okText="删除"
          onConfirm={() => {
            onDelete(entry);
          }}
          title={`确认删除 ${entry.name}？`}
        >
          <Button
            aria-label={`删除 ${entry.name}`}
            danger
            disabled={deleting}
            icon={<DeleteOutlined />}
            shape="circle"
            size="small"
            type="text"
          />
        </Popconfirm>
      </div>
    </div>
  );
}
