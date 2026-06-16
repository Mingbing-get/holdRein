import {
  ArrowLeftOutlined,
  ExperimentOutlined,
  SettingOutlined
} from "@ant-design/icons";
import { Button, Typography } from "antd";

import { useAppPlugins } from "../../../app/app-plugin";
import { useAppUi } from "../../../app/app-ui-context";

export function SettingsNav() {
  const { settings } = useAppPlugins();
  const {
    setActiveMainView,
    openWorkspaceNavigation,
    state: { activeMainView, sidebarCollapsed }
  } = useAppUi();

  return (
    <nav
      aria-label="Settings navigation"
      style={{
        display: "flex",
        flex: 1,
        flexDirection: "column",
        gap: 12,
        minHeight: 0,
        overflow: "hidden"
      }}
    >
      <Button
        aria-label="返回工作区导航"
        block
        icon={<ArrowLeftOutlined />}
        onClick={openWorkspaceNavigation}
        style={{
          borderColor: "var(--app-color-border-secondary)",
          borderRadius: 6,
          color: "var(--app-color-text)",
          fontSize: 12,
          flexShrink: 0,
          justifyContent: sidebarCollapsed ? "center" : "flex-start"
        }}
        type="text"
      >
        {sidebarCollapsed ? null : "返回"}
      </Button>
      <div
        aria-label="Settings sections"
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          gap: 4,
          minHeight: 0,
          overflowY: "auto"
        }}
      >
        {!sidebarCollapsed ? (
          <Typography.Text
            style={{
              color: "var(--app-color-text-secondary)",
              display: "block",
              fontSize: 12,
              lineHeight: "20px",
              padding: "2px 8px"
            }}
          >
            设置
          </Typography.Text>
        ) : null}
        <Button
          aria-label="模型配置"
          block
          icon={<ExperimentOutlined />}
          onClick={() => setActiveMainView('modelProviders')}
          style={{
            background:
              activeMainView === "modelProviders"
                ? "var(--app-color-fill-secondary)"
                : undefined,
            borderRadius: 6,
            color: "var(--app-color-text)",
            fontSize: 12,
            justifyContent: sidebarCollapsed ? "center" : "flex-start"
          }}
          type="text"
        >
          {sidebarCollapsed ? null : "模型配置"}
        </Button>
        {settings.map((setting) => (
          <Button
            aria-label={setting.title}
            block
            icon={setting.icon}
            key={setting.id}
            onClick={() => setActiveMainView(setting.id)}
            style={{
              background:
                activeMainView === setting.id
                  ? "var(--app-color-fill-secondary)"
                  : undefined,
              borderRadius: 6,
              color: "var(--app-color-text)",
              fontSize: 12,
              justifyContent: sidebarCollapsed ? "center" : "flex-start"
            }}
            type="text"
          >
            {sidebarCollapsed ? null : setting.title}
          </Button>
        ))}
      </div>
    </nav>
  );
}
