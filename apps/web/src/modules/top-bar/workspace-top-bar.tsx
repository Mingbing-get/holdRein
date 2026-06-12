import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoonOutlined,
  SettingOutlined,
  SunOutlined
} from "@ant-design/icons";
import { Button, Space, Switch, Tooltip } from "antd";

import { useAppUi } from "../../app/app-ui-context";

export function WorkspaceTopBar() {
  const {
    state: { sidebarCollapsed, themeMode },
    openSettingsNavigation,
    toggleSidebar,
    toggleThemeMode
  } = useAppUi();

  return (
    <header
      data-testid="workspace-top-bar"
      style={{
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid var(--app-color-border-secondary)",
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
          <Button
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={toggleSidebar}
            shape="circle"
            size="small"
            type="text"
          />
          <span />
        </Space>
        <Space align="center" size={10}>
          <Tooltip title="设置">
            <Button
              aria-label="Open settings"
              icon={<SettingOutlined />}
              onClick={openSettingsNavigation}
              shape="circle"
              size="small"
              type="text"
            />
          </Tooltip>
          <Switch
            aria-label="Toggle theme"
            checked={themeMode === "dark"}
            checkedChildren={<MoonOutlined />}
            onChange={toggleThemeMode}
            unCheckedChildren={<SunOutlined />}
          />
        </Space>
      </div>
    </header>
  );
}
