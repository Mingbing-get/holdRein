interface ChatWorkspaceProps {
  activeConversationName: string;
  apiBaseUrl: string;
}

export function ChatWorkspace({
  activeConversationName: _activeConversationName,
  apiBaseUrl: _apiBaseUrl
}: ChatWorkspaceProps) {
  return <div data-testid="chat-workspace" />;
}
