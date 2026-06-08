import { Layout } from "antd";
import { useEffect } from "react";

import { useAppUi } from "../../app/app-ui-context";
import { ChatWorkspace } from "../chat/chat-workspace";
import { LeftSideAside } from "../LeftSide/aside";
import { fetchWorkspaceNavigation } from "../LeftSide/workspace-nav-api";
import { WorkspaceNav } from "../LeftSide/workspace-nav";
import { ModelProvidersView } from "../model-providers";
import { WorkspaceTopBar } from "../top-bar/workspace-top-bar";

interface HoldReinShellProps {
  apiBaseUrl: string;
}

export function HoldReinShell({ apiBaseUrl }: HoldReinShellProps) {
  const {
    state: {
      activeConversationId,
      activeMainView,
      activeWorkspaceId,
      sidebarCollapsed,
      sidebarResizing,
      sidebarWidth,
      workspaces
    },
    setActiveConversationId,
    setActiveWorkspaceId,
    setWorkspaces
  } = useAppUi();

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
    activeWorkspace?.tasks.find((task) => task.id === activeConversationId) ??
    activeWorkspace?.tasks[0];

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }

    if (activeWorkspace.id !== activeWorkspaceId) {
      setActiveWorkspaceId(activeWorkspace.id);
    }

    if (activeTask && activeTask.id !== activeConversationId) {
      setActiveConversationId(activeTask.id);
    }

    if (!activeTask && activeConversationId) {
      setActiveConversationId("");
    }
  }, [
    activeConversationId,
    activeTask,
    activeWorkspace,
    activeWorkspaceId,
    setActiveConversationId,
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
        <WorkspaceNav />
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
        <Layout.Content style={{ padding: "10px 14px 14px", display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 41px)' }}>
          {activeMainView === "modelProviders" ? (
            <ModelProvidersView apiBaseUrl={apiBaseUrl} />
          ) : (
            <ChatWorkspace
              activeConversationName={activeTask?.title ?? ""}
              apiBaseUrl={apiBaseUrl}
            />
          )}
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
