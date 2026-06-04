import { Layout } from "antd";

import { useAppUi } from "../../app/app-ui-context";
import { workspaceSummaries } from "../../shared/mock/workspaces";
import { ChatWorkspace } from "../chat/chat-workspace";
import { ModelProvidersView } from "../model-providers";
import { WorkspaceSidebar } from "../workspace-nav/workspace-sidebar";
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
      sidebarWidth
    }
  } = useAppUi();
  const defaultWorkspace = workspaceSummaries[0];

  if (!defaultWorkspace) {
    throw new Error("At least one workspace summary is required");
  }

  const activeWorkspace =
    workspaceSummaries.find((workspace) => workspace.id === activeWorkspaceId) ??
    defaultWorkspace;
  const defaultConversation = activeWorkspace.conversations[0];

  if (!defaultConversation) {
    throw new Error("At least one conversation is required per workspace");
  }

  const activeConversation =
    activeWorkspace.conversations.find(
      (conversation) => conversation.id === activeConversationId
    ) ?? defaultConversation;

  return (
    <Layout
      style={{
        minHeight: "100vh",
        background: "transparent",
      }}
    >
      <WorkspaceSidebar />
      <Layout
        data-testid="workspace-main-layout"
        style={{
          background: "transparent",
          marginLeft: sidebarCollapsed ? 0 : sidebarWidth,
          transition: sidebarResizing ? "none" : "margin-left 0.2s ease"
        }}
      >
        <WorkspaceTopBar />
        <Layout.Content style={{ padding: "10px 14px 14px" }}>
          {activeMainView === "modelProviders" ? (
            <ModelProvidersView apiBaseUrl={apiBaseUrl} />
          ) : (
            <ChatWorkspace
              activeConversationName={activeConversation.name}
              apiBaseUrl={apiBaseUrl}
            />
          )}
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
