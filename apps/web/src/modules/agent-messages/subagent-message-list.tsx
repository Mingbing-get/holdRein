import { useAgentTasks } from "./agent-tasks-context";
import { AgentMessageList } from "./message-list";

export interface SubagentMessageListProps {
  agentId: string;
}

export function SubagentMessageList({ agentId }: SubagentMessageListProps) {
  const { getSubagentMessages } = useAgentTasks();
  return <AgentMessageList messages={getSubagentMessages(agentId)} />;
}
