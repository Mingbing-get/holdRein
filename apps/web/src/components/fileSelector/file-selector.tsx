import {
  CheckOutlined,
  FileOutlined,
  FolderOpenOutlined,
  FolderOutlined
} from "@ant-design/icons";
import { Breadcrumb, Button, Flex, Modal, Spin, Tooltip, Typography } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchFileSystemEntries } from "./file-selector-api";
import type {
  FileSelectorSelectableType,
  FileSystemDirectoryListing,
  FileSystemEntry
} from "./file-selector-types";

import "./file-selector.css";

interface FileSelectorBaseProps {
  apiBaseUrl?: string;
  className?: string;
  onCancel?: () => void;
  open: boolean;
  parentPath?: string;
  selectableTypes: FileSelectorSelectableType[];
  title?: string;
  zIndex?: number;
}

export interface SingleFileSelectorProps extends FileSelectorBaseProps {
  multiple?: false;
  onConfirm: (path: string) => void;
}

export interface MultipleFileSelectorProps extends FileSelectorBaseProps {
  multiple: true;
  onConfirm: (paths: string[]) => void;
}

export type FileSelectorProps =
  | MultipleFileSelectorProps
  | SingleFileSelectorProps;

export function FileSelector(props: FileSelectorProps) {
  const {
    apiBaseUrl = "",
    open,
    selectableTypes,
    title = "选择文件",
    zIndex
  } = props;
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const hasSelection = selectedPaths.length > 0;
  const multiple = props.multiple === true;

  useEffect(() => {
    if (!open) {
      setSelectedPaths([]);
    }
  }, [open]);

  const handleToggleSelection = useCallback(
    (entry: FileSystemEntry) => {
      setSelectedPaths((currentPaths) => {
        if (!multiple) {
          return [entry.path];
        }

        return currentPaths.includes(entry.path)
          ? currentPaths.filter((path) => path !== entry.path)
          : [...currentPaths, entry.path];
      });
    },
    [multiple]
  );

  const handleConfirm = useCallback(() => {
    if (selectedPaths.length === 0) {
      return;
    }

    if (props.multiple === true) {
      props.onConfirm(selectedPaths);
      return;
    }

    const selectedPath = selectedPaths[0];

    if (selectedPath) {
      props.onConfirm(selectedPath);
    }
  }, [props, selectedPaths]);

  return (
    <Modal
      cancelText="取消"
      okButtonProps={{ "aria-label": "确定", disabled: !hasSelection }}
      okText="确定"
      onOk={handleConfirm}
      open={open}
      title={title}
      width={680}
      {...(zIndex === undefined ? {} : { zIndex })}
      styles={{
        body: {
          maxHeight: "60vh",
          overflowY: "auto"
        }
      }}
      {...(props.onCancel ? { onCancel: props.onCancel } : {})}
    >
      <FileSelectorBrowser
        apiBaseUrl={apiBaseUrl}
        open={open}
        selectableTypes={selectableTypes}
        selectedPaths={selectedPaths}
        onToggleSelection={handleToggleSelection}
        {...(props.className ? { className: props.className } : {})}
        {...(props.parentPath ? { parentPath: props.parentPath } : {})}
      />
    </Modal>
  );
}

interface FileSelectorBrowserProps {
  apiBaseUrl: string;
  className?: string;
  onToggleSelection: (entry: FileSystemEntry) => void;
  open: boolean;
  parentPath?: string;
  selectableTypes: FileSelectorSelectableType[];
  selectedPaths: string[];
}

function FileSelectorBrowser({
  apiBaseUrl,
  className,
  onToggleSelection,
  open,
  parentPath,
  selectableTypes,
  selectedPaths
}: FileSelectorBrowserProps) {
  const [listing, setListing] = useState<FileSystemDirectoryListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedSelectableTypes = useMemo(
    () => normalizeSelectableTypes(selectableTypes),
    [selectableTypes]
  );

  const loadDirectory = useCallback(
    (parentPath?: string) => {
      setLoading(true);
      setError(null);

      void fetchFileSystemEntries(apiBaseUrl, parentPath)
        .then((nextListing) => {
          setListing(nextListing);
        })
        .catch(() => {
          setError("目录加载失败");
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [apiBaseUrl]
  );

  useEffect(() => {
    if (!open) {
      setListing(null);
      setError(null);
      return;
    }

    loadDirectory(parentPath);
  }, [loadDirectory, open, parentPath]);

  const rootPath = listing?.parentPath ?? parentPath ?? "";
  const classNames = ["file-selector", className].filter(Boolean).join(" ");

  return (
    <section className={classNames}>
      <div className="file-selector__header">
        <Breadcrumb
          items={createBreadcrumbItems(rootPath, loadDirectory)}
        />
      </div>
      <div className="file-selector__content">
        {loading ? (
          <Flex align="center" justify="center" style={{ minHeight: 180 }}>
            <Spin />
          </Flex>
        ) : null}
        {!loading && error ? (
          <div className="file-selector__error">{error}</div>
        ) : null}
        {!loading && !error && listing?.entries.length === 0 ? (
          <div className="file-selector__empty">当前目录为空</div>
        ) : null}
        {!loading && !error
          ? listing?.entries.map((entry) => (
              <FileSelectorEntry
                entry={entry}
                isSelectable={isEntrySelectable(entry, normalizedSelectableTypes)}
                isSelected={selectedPaths.includes(entry.path)}
                key={entry.path}
                onOpenFolder={loadDirectory}
                onToggleSelection={onToggleSelection}
              />
            ))
          : null}
      </div>
    </section>
  );
}

interface FileSelectorEntryProps {
  entry: FileSystemEntry;
  isSelectable: boolean;
  isSelected: boolean;
  onOpenFolder: (path: string) => void;
  onToggleSelection: (entry: FileSystemEntry) => void;
}

function FileSelectorEntry({
  entry,
  isSelectable,
  isSelected,
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
        disabled={!isFolder && !isSelectable}
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
      {isFolder && !isSelectable ? (
        <FolderOpenOutlined aria-hidden="true" />
      ) : null}
      {!isFolder && isSelected ? (
        <CheckOutlined aria-hidden="true" />
      ) : null}
    </div>
  );
}

function normalizeSelectableTypes(
  selectableTypes: FileSelectorSelectableType[]
): Set<FileSelectorSelectableType> {
  return new Set<FileSelectorSelectableType>(
    selectableTypes.map((type) =>
      type === "folder" ? type : (type.toLowerCase() as `.${string}`)
    )
  );
}

function isEntrySelectable(
  entry: FileSystemEntry,
  selectableTypes: Set<FileSelectorSelectableType>
): boolean {
  if (entry.kind === "folder") {
    return selectableTypes.has("folder");
  }

  return selectableTypes.has(entry.extension.toLowerCase() as `.${string}`);
}

function createBreadcrumbItems(
  currentPath: string,
  onOpenFolder: (path?: string) => void
) {
  const parts = currentPath.split("/").filter(Boolean);
  const items = [
    {
      title: (
        <Button
          onClick={() => {
            onOpenFolder(undefined);
          }}
          size="small"
          type="text"
        >
          根目录
        </Button>
      )
    }
  ];

  parts.forEach((part, index) => {
    const path = `/${parts.slice(0, index + 1).join("/")}`;

    items.push({
      title: (
        <Button
          onClick={() => {
            onOpenFolder(path);
          }}
          size="small"
          type="text"
        >
          <Typography.Text>{part}</Typography.Text>
        </Button>
      )
    });
  });

  return items;
}
