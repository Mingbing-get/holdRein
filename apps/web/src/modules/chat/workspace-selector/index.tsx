import { DownOutlined, FolderOpenOutlined } from "@ant-design/icons";
import { Button, ConfigProvider, Divider, Select } from "antd";
import { useCallback, useState } from "react";

import { FileSelector } from "../../../components/fileSelector";

interface WorkspaceOption {
  label: string;
  value: string;
}

interface WorkspaceSelectorProps {
  apiBaseUrl: string;
}

const initialWorkspaceOptions: WorkspaceOption[] = [
  {
    label: "holdRein",
    value: "/Users/mingbing/apps/ai-project/holdRein"
  },
  {
    label: "demo-workspace",
    value: "/Users/mingbing/apps/demo-workspace"
  }
];
const defaultWorkspaceValue = initialWorkspaceOptions[0]?.value ?? "";

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
  const [options, setOptions] = useState<WorkspaceOption[]>(
    initialWorkspaceOptions
  );
  const [selectedWorkspacePath, setSelectedWorkspacePath] =
    useState(defaultWorkspaceValue);
  const [selectOpen, setSelectOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const handleConfirmWorkspace = useCallback((path: string) => {
    const nextOption: WorkspaceOption = {
      label: getWorkspaceLabelFromPath(path),
      value: path
    };

    setOptions((currentOptions) => {
      const optionExists = currentOptions.some(
        (option) => option.value === nextOption.value
      );

      return optionExists ? currentOptions : [...currentOptions, nextOption];
    });
    setSelectedWorkspacePath(path);
    setSelectorOpen(false);
  }, []);

  return (
    <>
      <ConfigProvider theme={workspaceSelectTheme}>
        <Select
          aria-label="工作空间"
          options={options}
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
          value={selectedWorkspacePath}
          variant="borderless"
          onChange={setSelectedWorkspacePath}
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
