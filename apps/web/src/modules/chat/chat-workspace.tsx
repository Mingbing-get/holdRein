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
    <div
      data-testid="chat-workspace"
      style={{
        display: "flex",
        flex: 1,
        flexDirection: "column",
        fontSize: 12,
        gap: 12,
        padding: "4px 0 12px"
      }}
    >
      <div
        style={{
          background:
            "linear-gradient(140deg, rgba(31,111,235,0.08), rgba(124,199,255,0.03))",
          border: "1px solid rgba(127, 145, 170, 0.2)",
          borderRadius: 16,
          padding: 14
        }}
      >
        <Space size={8} wrap>
          <Tag color="blue">Conversation Workspace</Tag>
          <Tag>Static Layout Preview</Tag>
        </Space>
        <Typography.Title
          level={5}
          style={{ fontSize: 12, marginTop: 10, marginBottom: 4 }}
        >
          {activeConversationName}
        </Typography.Title>
        <Typography.Paragraph
          style={{ fontSize: 12, marginBottom: 8, marginTop: 0, maxWidth: 680 }}
        >
          This is the shared chat surface for future model conversations, task
          execution, and workspace-aware assistant actions.
        </Typography.Paragraph>
        <Typography.Text type="secondary">
          API Base URL: {apiBaseUrl || "Not configured"}
        </Typography.Text>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
        }}
      >
        {quickActions.map((action) => (
          <div
            key={action}
            style={{
              background: "#ffffff",
              border: "1px solid rgba(127, 145, 170, 0.18)",
              borderRadius: 14,
              minHeight: 96,
              padding: 12
            }}
          >
            <Typography.Text strong style={{ fontSize: 12 }}>
              {action}
            </Typography.Text>
            <Typography.Paragraph
              style={{ fontSize: 12, marginTop: 6, marginBottom: 0 }}
              type="secondary"
            >
              Reserved for the next implementation step. This block is ready for
              real actions, prompts, or task controls.
            </Typography.Paragraph>
          </div>
        ))}
      </div>

      <div
        style={{
          alignItems: "center",
          background: "#ffffff",
          border: "1px dashed rgba(127, 145, 170, 0.35)",
          borderRadius: 14,
          display: "flex",
          gap: 12,
          justifyContent: "space-between",
          padding: 12
        }}
      >
        <div>
          <Typography.Text strong style={{ fontSize: 12 }}>
            Input Composer Placeholder
          </Typography.Text>
          <Typography.Paragraph
            style={{ fontSize: 12, margin: 0, marginTop: 2 }}
            type="secondary"
          >
            The prompt editor, attachments, and long-task controls will live
            here next.
          </Typography.Paragraph>
        </div>
        <Button size="small" type="primary">
          Compose
        </Button>
      </div>
    </div>
  );
}
