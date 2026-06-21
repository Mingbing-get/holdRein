import { BranchesOutlined } from "@ant-design/icons";
import { Think } from "@ant-design/x";
import { useMemo } from "react";

import { useAgentTasks } from "../tasks-context";
import { AgentMessageList } from "../message-list";

export interface SubagentMessageListProps {
  agentId: string;
}

export function SubagentMessageList({ agentId }: SubagentMessageListProps) {
  const { getSubagentMessages, getSubagentStatus } = useAgentTasks();

  const messages = useMemo(
    () => getSubagentMessages(agentId),
    [agentId, getSubagentMessages]
  );

  const status = useMemo(() => getSubagentStatus(agentId), [agentId, getSubagentStatus]);

  return (
    <Think
      title="call subagent"
      icon={<BranchesOutlined />}
      defaultExpanded={false}
      loading={status === "running"}
      blink
    >
      <AgentMessageList messages={messages} status={status} />
    </Think>
  );
}
