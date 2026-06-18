import { useMemo } from 'react';
import { Think } from '@ant-design/x'
import { BranchesOutlined } from '@ant-design/icons';
import { useAgentTasks } from "./agent-tasks-context";
import { AgentMessageList } from "./message-list";

export interface SubagentMessageListProps {
  agentId: string;
}

export function SubagentMessageList({ agentId }: SubagentMessageListProps) {
  const { getSubagentMessages } = useAgentTasks();

  const messages = useMemo(() => getSubagentMessages(agentId), [getSubagentMessages, agentId])

  return (
    <Think
      title='call subagent'
      icon={<BranchesOutlined />}
      defaultExpanded={false}
      blink
    >
      <AgentMessageList messages={messages} />
    </Think>
  );
}
