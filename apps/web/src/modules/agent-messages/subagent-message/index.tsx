import { BranchesOutlined } from "@ant-design/icons";
import { Think } from "@ant-design/x";

import { useAgentTasks } from "../tasks-context";
import { AgentMessageList } from "../message-list";

export interface SubagentMessageListProps {
  agentId: string;
}

export function SubagentMessageList({ agentId }: SubagentMessageListProps) {
  const { getSubagentStatus } = useAgentTasks();
  const status = getSubagentStatus(agentId);

  return (
    <Think
      title="调用子智能体"
      icon={<BranchesOutlined />}
      defaultExpanded={false}
      loading={status === "running"}
      blink
    >
      <AgentMessageList agentId={agentId} status={status} />
    </Think>
  );
}
