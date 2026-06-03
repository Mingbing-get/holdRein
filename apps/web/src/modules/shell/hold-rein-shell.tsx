import { Layout, Typography } from "antd";

import { useAppUi } from "../../app/app-ui-context";
import { workspaceSummaries } from "../../shared/mock/workspaces";
import { ChatWorkspace } from "../chat/chat-workspace";
import { WorkspaceSidebar } from "../workspace-nav/workspace-sidebar";
import { WorkspaceTopBar } from "../top-bar/workspace-top-bar";

interface HoldReinShellProps {
  apiBaseUrl: string;
}

export function HoldReinShell({ apiBaseUrl }: HoldReinShellProps) {
  const {
    state: { activeConversationId, activeWorkspaceId, sidebarCollapsed }
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
        background:
          "radial-gradient(circle at top left, rgba(31,111,235,0.08), transparent 26%), #f4f6fb"
      }}
    >
      <WorkspaceSidebar />
      <Layout
        style={{
          background: "#f4f6fb",
          marginLeft: sidebarCollapsed ? 88 : 320,
          transition: "margin-left 0.2s ease"
        }}
      >
        <WorkspaceTopBar workspaceName={activeWorkspace.name} />
        <Layout.Content style={{ padding: "10px 14px 14px" }}>
          <Typography.Text type="secondary">{activeWorkspace.path}</Typography.Text>
          <ChatWorkspace
            activeConversationName={activeConversation.name}
            apiBaseUrl={apiBaseUrl}
          />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
