import { Button, Space, Tag, Typography } from "antd";

interface ChatWorkspaceProps {
  activeConversationName: string;
  apiBaseUrl: string;
}

const quickActions = [
  "Start a new planning thread",
  "Review workspace changes",
  "Prepare a long-running task"
];

export function ChatWorkspace({
  activeConversationName,
  apiBaseUrl
}: ChatWorkspaceProps) {
  return (
    <div></div>
  );
}
