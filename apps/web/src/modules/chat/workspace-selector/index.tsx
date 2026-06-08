import { DownOutlined, FolderOpenOutlined } from "@ant-design/icons";
import { Button, ConfigProvider, Divider, Select } from "antd";
import { useCallback, useMemo, useState } from "react";

import { useAppWorkspace } from "../../../app/app-workspace-context";
import { FileSelector } from "../../../components/fileSelector";
import type { WorkspaceSummary } from "../../LeftSide/workspace-nav-types";

interface WorkspaceOption {
  label: string;
  value: string;
}

interface WorkspaceSelectorProps {
  apiBaseUrl: string;
}

const workspaceSelectTheme = {
  components: {
    Select: {
      colorText: "var(--app-color-text)",
      colorTextPlaceholder: "var(--app-color-text)",
      optionActiveBg: "var(--app-color-fill-secondary)",
      optionSelectedBg:
        "color-mix(in srgb, var(--app-color-primary) 16%, var(--app-color-bg-elevated))",
      optionSelectedColor: "var(--app-color-text)"
    }
  }
} as const;

export function getWorkspaceLabelFromPath(path: string): string {
  const normalizedPath = path.replace(/\/+$/, "");
  const parts = normalizedPath.split("/").filter(Boolean);

  return parts[parts.length - 1] ?? path;
}

export function WorkspaceSelector({ apiBaseUrl }: WorkspaceSelectorProps) {
  const {
    state: { activeWorkspaceId, workspaces },
    setActiveTaskId,
    setActiveWorkspaceId,
    setWorkspaces
  } = useAppWorkspace();
  const [selectOpen, setSelectOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const options = useMemo<WorkspaceOption[]>(
    () =>
      workspaces.map((workspace) => ({
        label: workspace.name,
        value: workspace.path
      })),
    [workspaces]
  );
  const selectedWorkspacePath = workspaces.find(
    (workspace) => workspace.id === activeWorkspaceId
  )?.path;

  const selectWorkspace = useCallback(
    (workspace: WorkspaceSummary) => {
      setActiveWorkspaceId(workspace.id);
      setActiveTaskId(workspace.tasks[0]?.id ?? "");
    },
    [setActiveTaskId, setActiveWorkspaceId]
  );

  const handleChangeWorkspace = useCallback(
    (path: string) => {
      const workspace = workspaces.find(
        (currentWorkspace) => currentWorkspace.path === path
      );

      if (workspace) {
        selectWorkspace(workspace);
      }
    },
    [selectWorkspace, workspaces]
  );

  const handleConfirmWorkspace = useCallback(
    (path: string) => {
      const existingWorkspace = workspaces.find(
        (workspace) => workspace.path === path
      );
      const nextWorkspace =
        existingWorkspace ?? createLocalWorkspaceSummary(path);

      if (!existingWorkspace) {
        setWorkspaces((currentWorkspaces) => {
          const workspaceExists = currentWorkspaces.some(
            (workspace) => workspace.path === nextWorkspace.path
          );

          return workspaceExists
            ? currentWorkspaces
            : [...currentWorkspaces, nextWorkspace];
        });
      }

      selectWorkspace(nextWorkspace);
      setSelectorOpen(false);
    },
    [selectWorkspace, setWorkspaces, workspaces]
  );

  return (
    <>
      <ConfigProvider theme={workspaceSelectTheme}>
        <Select
          aria-label="工作空间"
          options={options}
          optionLabelProp="label"
          placeholder="选择工作空间"
          popupMatchSelectWidth={220}
          popupRender={(originNode) => (
            <>
              {originNode}
              <Divider style={{ margin: "6px 0" }} />
              <Button
                aria-label="选择工作空间"
                icon={<FolderOpenOutlined />}
                onClick={() => {
                  setSelectOpen(false);
                  setSelectorOpen(true);
                }}
                style={{
                  justifyContent: "flex-start",
                  width: "100%"
                }}
                type="text"
              >
                选择工作空间
              </Button>
            </>
          )}
          open={selectOpen}
          size="small"
          style={{ width: "fit-content" }}
          suffixIcon={<DownOutlined style={{ color: "var(--app-color-text)" }} />}
          value={selectedWorkspacePath ?? null}
          variant="borderless"
          onChange={handleChangeWorkspace}
          onOpenChange={setSelectOpen}
        />
      </ConfigProvider>
      <FileSelector
        title="选择工作空间"
        apiBaseUrl={apiBaseUrl}
        open={selectorOpen}
        selectableTypes={["folder"]}
        onCancel={() => {
          setSelectorOpen(false);
        }}
        onConfirm={handleConfirmWorkspace}
      />
    </>
  );
}

function createLocalWorkspaceSummary(path: string): WorkspaceSummary {
  return {
    hasMore: false,
    id: `local-workspace:${path}`,
    name: getWorkspaceLabelFromPath(path),
    path,
    tasks: []
  };
}
