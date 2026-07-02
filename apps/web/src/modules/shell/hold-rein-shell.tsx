import { Layout } from "antd";
import { useEffect } from "react";

import { useAppPlugins } from "../../app/app-plugin";
import { useAppUi } from "../../app/app-ui-context";
import { useAppWorkspace } from "../../app/app-workspace-context";
import { ChatWorkspace } from "../chat/chat-workspace";
import { LeftSideAside } from "../leftSide/aside";
import { SettingsNav } from "../leftSide/settings-nav";
import { fetchWorkspaceNavigation } from "../leftSide/workspace-nav-api";
import { WorkspaceNav } from "../leftSide/workspace-nav";
import { ModelProvidersView } from "../model-providers";
import { PluginManagementView } from "../plugins";
import { RightSideAside } from "../rightSide/aside";
import { SkillManagementView } from "../skills";
import { ScheduledTasksView } from "../scheduled-tasks";
import { WorkspaceTopBar } from "../top-bar/workspace-top-bar";
import { UsageStatsView } from "../usage-stats";

interface HoldReinShellProps {
  apiBaseUrl: string;
}

export function HoldReinShell({ apiBaseUrl }: HoldReinShellProps) {
  const { settings } = useAppPlugins();
  const {
    state: {
      activeMainView,
      activeSidebarView,
      sidebarCollapsed,
      sidebarResizing,
      sidebarWidth
    }
  } = useAppUi();
  const {
    state: {
      activeTaskId,
      activeWorkspaceId,
      newConversationWorkspaceId,
      workspaces
    },
    setActiveTaskId,
    setActiveWorkspaceId,
    setWorkspaces
  } = useAppWorkspace();

  useEffect(() => {
    let ignore = false;

    void fetchWorkspaceNavigation(apiBaseUrl)
      .then((navigation) => {
        if (!ignore) {
          setWorkspaces(navigation.workspaces);
        }
      })
      .catch(() => {
        if (!ignore) {
          setWorkspaces([]);
        }
      });

    return () => {
      ignore = true;
    };
  }, [apiBaseUrl, setWorkspaces]);

  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ??
    workspaces[0];
  const activeTask =
    activeWorkspace?.tasks.find((task) => task.id === activeTaskId) ??
    (activeWorkspace?.id === newConversationWorkspaceId
      ? undefined
      : activeWorkspace?.tasks[0]);
  const activePluginSetting = settings.find(
    (setting) => setting.id === activeMainView
  );
  const ActivePluginSettingRender = activePluginSetting?.Render;

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }

    if (activeWorkspace.id !== activeWorkspaceId) {
      setActiveWorkspaceId(activeWorkspace.id);
    }

    if (activeTask && activeTask.id !== activeTaskId) {
      setActiveTaskId(activeTask.id);
    }

    if (!activeTask && activeTaskId) {
      setActiveTaskId("");
    }
  }, [
    activeTaskId,
    activeTask,
    activeWorkspace,
    activeWorkspaceId,
    newConversationWorkspaceId,
    setActiveTaskId,
    setActiveWorkspaceId
  ]);

  return (
    <Layout
      style={{
        minHeight: "100vh",
        background: "transparent",
      }}
    >
      <LeftSideAside>
        {activeSidebarView === "settings" ? (
          <SettingsNav />
        ) : (
          <WorkspaceNav apiBaseUrl={apiBaseUrl} />
        )}
      </LeftSideAside>
      <Layout
        data-testid="workspace-main-layout"
        style={{
          background: "transparent",
          marginLeft: sidebarCollapsed ? 0 : sidebarWidth,
          transition: sidebarResizing ? "none" : "margin-left 0.2s ease"
        }}
      >
        <WorkspaceTopBar />
        <Layout.Content
          style={{
            display: "flex",
            flexDirection: "column",
            maxHeight: "calc(100vh - 41px)",
            padding: activeMainView === "chat" ? 0 : "10px 14px 14px"
          }}
        >
          {ActivePluginSettingRender ? (
            <ActivePluginSettingRender />
          ) : activeMainView === "modelProviders" ? (
            <ModelProvidersView apiBaseUrl={apiBaseUrl} />
          ) : activeMainView === "skills" ? (
            <SkillManagementView apiBaseUrl={apiBaseUrl} />
          ) : activeMainView === "plugins" ? (
            <PluginManagementView apiBaseUrl={apiBaseUrl} />
          ) : activeMainView === "scheduledTasks" ? (
            <ScheduledTasksView apiBaseUrl={apiBaseUrl} />
          ) : activeMainView === "usageStats" ? (
            <UsageStatsView apiBaseUrl={apiBaseUrl} />
          ) : (
            <div
              style={{
                display: "flex",
                flex: 1,
                minHeight: 0,
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  display: "flex",
                  flex: 1,
                  minWidth: 0,
                  padding: "10px"
                }}
              >
                <ChatWorkspace
                  activeTaskName={activeTask?.title ?? ""}
                  apiBaseUrl={apiBaseUrl}
                />
              </div>
              <RightSideAside />
            </div>
          )}
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
