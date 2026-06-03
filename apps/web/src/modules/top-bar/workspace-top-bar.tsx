import {
  ExperimentOutlined,
  MoonOutlined,
  SettingOutlined,
  SunOutlined
} from "@ant-design/icons";
import { Button, Space, Switch, Tooltip } from "antd";

import { useAppUi } from "../../app/app-ui-context";

interface WorkspaceTopBarProps {
  workspaceName: string;
}

export function WorkspaceTopBar({ workspaceName }: WorkspaceTopBarProps) {
  const {
    state: { themeMode },
    toggleThemeMode
  } = useAppUi();
  const isDarkMode = themeMode === "dark";

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
          <span
            style={{
              color: "rgba(127, 145, 170, 0.88)",
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "uppercase"
            }}
          >
            {workspaceName}
          </span>
        </Space>
        <Space align="center" size={10}>
          <Tooltip title="Model configuration">
            <Button
              aria-label="Model configuration"
              icon={<ExperimentOutlined />}
              shape="circle"
              size="small"
              type="text"
            />
          </Tooltip>
          <Tooltip title="Open settings">
            <Button
              aria-label="Open settings"
              icon={<SettingOutlined />}
              shape="circle"
              size="small"
              type="text"
            />
          </Tooltip>
          <Switch
            aria-label="Toggle theme"
            checked={isDarkMode}
            checkedChildren={<MoonOutlined />}
            onChange={toggleThemeMode}
            unCheckedChildren={<SunOutlined />}
          />
        </Space>
      </div>
    </header>
  );
}
