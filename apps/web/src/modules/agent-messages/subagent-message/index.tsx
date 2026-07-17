import { useMemo } from "react";

import { BranchesOutlined } from "@ant-design/icons";
import { Think } from "@ant-design/x";

import { useAgentTasks } from "../tasks-context";
import { AgentMessageList } from "../message-list";

export interface SubagentMessageListProps {
  agentId: string;
}

export function SubagentMessageList({ agentId }: SubagentMessageListProps) {
  const { getSubagent } = useAgentTasks();

  const subAgent = getSubagent(agentId);

  const status = useMemo(() => subAgent?.status, [subAgent?.status]);
  
  const title = useMemo(
    () =>
      subAgent?.agentName
        ? `调用子智能体：${subAgent.agentName}`
        : "调用子智能体",
    [subAgent?.agentName]
  );

  return (
    <Think
      title={title}
      icon={<BranchesOutlined />}
      defaultExpanded={false}
      loading={status === "running"}
      blink
    >
      <AgentMessageList agentId={agentId} status={status} />
    </Think>
  );
}
