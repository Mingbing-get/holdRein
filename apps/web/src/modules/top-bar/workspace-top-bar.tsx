import { Button, Space, Tag, Typography } from "antd";

import { useAppUi } from "../../app/app-ui-context";

interface WorkspaceTopBarProps {
  workspaceName: string;
}

function getThemeLabel(themeMode: "light" | "dark") {
  return themeMode === "light" ? "Light mode" : "Dark mode";
}

export function WorkspaceTopBar({ workspaceName }: WorkspaceTopBarProps) {
  const {
    state: { themeMode },
    toggleThemeMode
  } = useAppUi();

  return (
    <header
      data-testid="workspace-top-bar"
      style={{
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(127, 145, 170, 0.18)",
        padding: "8px 16px",
        position: "sticky",
        top: 0,
        zIndex: 20
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 12,
          justifyContent: "space-between"
        }}
      >
        <Space size={8} wrap>
          <span></span>
        </Space>
        <Space size={8}>
          <Button aria-label="Open settings" shape="circle" size="small">
            ST
          </Button>
          <Button
            aria-label="Toggle theme"
            onClick={toggleThemeMode}
            shape="circle"
            size="small"
          >
            TM
          </Button>
          <Button aria-label="Manage models" shape="circle" size="small">
            MM
          </Button>
        </Space>
      </div>
    </header>
  );
}
