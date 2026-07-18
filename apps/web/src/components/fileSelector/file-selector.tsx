import { PlusOutlined } from "@ant-design/icons";
import { Breadcrumb, Button, Flex, Modal, Spin } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CreateFolderDialog } from "./create-folder-dialog";
import { FileSelectorEntry } from "./file-selector-entry";
import {
  createFileSystemFolder,
  deleteFileSystemEntry,
  fetchFileSystemEntries
} from "./file-selector-api";
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
  const [openCreateFolderDialog, setOpenCreateFolderDialog] = useState<
    (() => void) | null
  >(null);
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
  const handleRemoveSelectedPath = useCallback((path: string) => {
    setSelectedPaths((currentPaths) =>
      currentPaths.filter((currentPath) => currentPath !== path)
    );
  }, []);
  const handleCreateFolderActionChange = useCallback(
    (action: (() => void) | null) => {
      setOpenCreateFolderDialog(() => action);
    },
    []
  );
  const handleCancel = useCallback(() => {
    props.onCancel?.();
  }, [props]);

  return (
    <Modal
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
      footer={
        <Flex align="center" justify="space-between">
          <Button
            aria-label="新建文件夹"
            disabled={openCreateFolderDialog === null}
            icon={<PlusOutlined />}
            onClick={() => {
              openCreateFolderDialog?.();
            }}
          >
            新建文件夹
          </Button>
          <Flex gap={8}>
            <Button onClick={handleCancel}>取消</Button>
            <Button
              aria-label="确定"
              disabled={!hasSelection}
              onClick={handleConfirm}
              type="primary"
            >
              确定
            </Button>
          </Flex>
        </Flex>
      }
      {...(props.onCancel ? { onCancel: props.onCancel } : {})}
    >
      <FileSelectorBrowser
        apiBaseUrl={apiBaseUrl}
        open={open}
        selectableTypes={selectableTypes}
        selectedPaths={selectedPaths}
        onCreateFolderActionChange={handleCreateFolderActionChange}
        onRemoveSelectedPath={handleRemoveSelectedPath}
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
  onCreateFolderActionChange: (action: (() => void) | null) => void;
  onRemoveSelectedPath: (path: string) => void;
  onToggleSelection: (entry: FileSystemEntry) => void;
  open: boolean;
  parentPath?: string;
  selectableTypes: FileSelectorSelectableType[];
  selectedPaths: string[];
}

function FileSelectorBrowser({
  apiBaseUrl,
  className,
  onCreateFolderActionChange,
  onRemoveSelectedPath,
  onToggleSelection,
  open,
  parentPath,
  selectableTypes,
  selectedPaths
}: FileSelectorBrowserProps) {
  const [listing, setListing] = useState<FileSystemDirectoryListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createFolderName, setCreateFolderName] = useState("");
  const [createFolderError, setCreateFolderError] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);

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
      setCreateFolderOpen(false);
      setCreateFolderName("");
      setCreateFolderError(null);
      setDeletingPath(null);
      return;
    }

    loadDirectory(parentPath);
  }, [loadDirectory, open, parentPath]);

  const rootPath = listing?.parentPath ?? parentPath ?? "";
  const classNames = ["file-selector", className].filter(Boolean).join(" ");
  const handleOpenCreateFolder = useCallback(() => {
    setCreateFolderName("");
    setCreateFolderError(null);
    setCreateFolderOpen(true);
  }, []);

  useEffect(() => {
    onCreateFolderActionChange(handleOpenCreateFolder);

    return () => {
      onCreateFolderActionChange(null);
    };
  }, [handleOpenCreateFolder, onCreateFolderActionChange]);

  const handleCloseCreateFolder = useCallback(() => {
    if (creatingFolder) {
      return;
    }

    setCreateFolderOpen(false);
    setCreateFolderName("");
    setCreateFolderError(null);
  }, [creatingFolder]);
  const handleChangeCreateFolderName = useCallback((name: string) => {
    setCreateFolderName(name);
    setCreateFolderError(null);
  }, []);
  const handleCreateFolder = useCallback(() => {
    const folderName = createFolderName.trim();

    if (!folderName) {
      setCreateFolderError("请输入文件夹名称");
      return;
    }

    const hasDuplicateFolder = listing?.entries.some(
      (entry) => entry.kind === "folder" && entry.name === folderName
    ) ?? false;

    if (hasDuplicateFolder) {
      setCreateFolderError("当前目录已存在同名文件夹");
      return;
    }

    setCreatingFolder(true);
    setCreateFolderError(null);

    void createFileSystemFolder(apiBaseUrl, rootPath, folderName)
      .then(() => {
        setCreateFolderOpen(false);
        setCreateFolderName("");
        loadDirectory(rootPath);
      })
      .catch(() => {
        setCreateFolderError("文件夹创建失败");
      })
      .finally(() => {
        setCreatingFolder(false);
      });
  }, [apiBaseUrl, createFolderName, listing?.entries, loadDirectory, rootPath]);
  const handleDeleteEntry = useCallback(
    (entry: FileSystemEntry) => {
      setDeletingPath(entry.path);
      setError(null);

      void deleteFileSystemEntry(apiBaseUrl, entry.path)
        .then(() => {
          onRemoveSelectedPath(entry.path);
          loadDirectory(rootPath);
        })
        .catch(() => {
          setError("删除失败");
        })
        .finally(() => {
          setDeletingPath(null);
        });
    },
    [apiBaseUrl, loadDirectory, onRemoveSelectedPath, rootPath]
  );

  return (
    <>
      <section className={classNames}>
        <div className="file-selector__header">
          <Breadcrumb items={createBreadcrumbItems(rootPath, loadDirectory)} />
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
                  deleting={deletingPath === entry.path}
                  entry={entry}
                  isSelectable={isEntrySelectable(entry, normalizedSelectableTypes)}
                  isSelected={selectedPaths.includes(entry.path)}
                  key={entry.path}
                  onDelete={handleDeleteEntry}
                  onOpenFolder={loadDirectory}
                  onToggleSelection={onToggleSelection}
                />
              ))
            : null}
        </div>
      </section>
      {createFolderOpen ? (
        <CreateFolderDialog
          creating={creatingFolder}
          error={createFolderError}
          name={createFolderName}
          onCancel={handleCloseCreateFolder}
          onChangeName={handleChangeCreateFolderName}
          onConfirm={handleCreateFolder}
        />
      ) : null}
    </>
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
          <span>{part}</span>
        </Button>
      )
    });
  });

  return items;
}
