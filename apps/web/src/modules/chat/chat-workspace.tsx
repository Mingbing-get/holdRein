import { useState } from "react";
import { Flex } from "antd";
import { Bubble, Think } from "@ant-design/x";

import Sender, { type SuggestionGroup } from "./sender";
import { WorkspaceSelector } from "./workspace-selector";

interface ChatWorkspaceProps {
  activeConversationName: string;
  apiBaseUrl: string;
}

const groups: SuggestionGroup[] = [
  {
    trigger: '/' as any,
    suggestions: [
      {
        label: "Run release checklist",
        value: "/release checklist"
      },
      {
        label: "Review incidents",
        value: "/incidents review"
      },
      {
        label: "Prepare handoff",
        value: "/handoff summary"
      }
    ]
  }
]

export function ChatWorkspace({
  activeConversationName,
  apiBaseUrl
}: ChatWorkspaceProps) {
  const [draftMessage, setDraftMessage] = useState("");

  return (
    <Flex
      data-api-base-url={apiBaseUrl}
      data-conversation-name={activeConversationName}
      data-testid="chat-workspace"
      vertical
      style={{
        background: "transparent",
        flex: 1,
        overflow: "hidden",
        gap: 8
      }}
    >
      <Flex
        vertical
        gap={16}
        style={{
          flex: 1,
          overflow: "auto",
        }}
      >
        <Bubble content="message 1" />
        <Bubble content="message 2" placement="end" />
        <Think
            blink
            loading={false}
            styles={{
              content: {
                color: "var(--app-color-text-secondary)"
              },
              root: {
                color: "var(--app-color-text-secondary)"
              },
              status: {
                color: "var(--app-color-text)"
              }
            }}
            title="Reasoning trace"
          >
            This is deep thinking content.
          </Think>
        <Bubble content="message 3" />
        <Bubble content="message 4" placement="end" />
        <Bubble content="message 3" />
        <Bubble content="message 4" placement="end" />
        <Bubble content="message 3" />
        <Bubble content="message 4" placement="end" />
        <Bubble content="message 3" />
        <Bubble content="message 4" placement="end" />
        <Bubble content="message 3" />
        <Bubble content="message 4" placement="end" />
        <Bubble content="message 3" />
        <Bubble content="message 4" placement="end" />
      </Flex>

      <Sender
        suggestionGroups={groups}
        onMessageChange={setDraftMessage}
        autoSize={{ minRows: 1, maxRows: 4 }}
        footer={<WorkspaceSelector apiBaseUrl={apiBaseUrl} />}
        onSubmit={async () => new Promise(resolve => setTimeout(resolve, 2000))}
      />
    </Flex>
  );
}
