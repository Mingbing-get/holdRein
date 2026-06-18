import { BranchesOutlined } from "@ant-design/icons";
import { Think } from "@ant-design/x";
import { useMemo } from "react";

import { useAgentTasks } from "./agent-tasks-context";
import { AgentMessageList } from "./message-list";

export interface SubagentMessageListProps {
  agentId: string;
}

export function SubagentMessageList({ agentId }: SubagentMessageListProps) {
  const { getSubagentMessages, getSubagentStatus } = useAgentTasks();

  const messages = useMemo(
    () => getSubagentMessages(agentId),
    [agentId, getSubagentMessages]
  );
  const isRunning = getSubagentStatus(agentId) === "running";

  return (
    <Think
      title="call subagent"
      icon={<BranchesOutlined />}
      defaultExpanded={false}
      loading={isRunning}
      blink
    >
      <AgentMessageList messages={messages} />
    </Think>
  );
}
