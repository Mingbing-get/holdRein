import { Think } from "@ant-design/x";

import type { AgentMessage } from "../agent-message-types";

export function ThinkingMessage({ message }: { message: AgentMessage }) {
  return (
    <Think
      styles={{
        content: { color: "var(--app-color-text-secondary)" },
        root: { color: "var(--app-color-text-secondary)" },
        status: { color: "var(--app-color-text)" }
      }}
      title="思考过程"
    >
      {message.content}
    </Think>
  );
}
