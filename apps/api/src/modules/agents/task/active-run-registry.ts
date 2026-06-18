export interface ActiveTaskRunRegistry {
  getAgentId: (taskId: string) => string | undefined;
  hasTask: (taskId: string) => boolean;
  markStarting: (taskId: string) => void;
  register: (taskId: string, agentId: string) => void;
  remove: (taskId: string) => void;
}

export function createActiveTaskRunRegistry(): ActiveTaskRunRegistry {
  const agentIdsByTaskId = new Map<string, string | undefined>();

  return {
    getAgentId: (taskId) => agentIdsByTaskId.get(taskId),
    hasTask: (taskId) => agentIdsByTaskId.has(taskId),
    markStarting: (taskId) => {
      agentIdsByTaskId.set(taskId, undefined);
    },
    register: (taskId, agentId) => {
      agentIdsByTaskId.set(taskId, agentId);
    },
    remove: (taskId) => {
      agentIdsByTaskId.delete(taskId);
    }
  };
}

const defaultActiveTaskRunRegistry = createActiveTaskRunRegistry();

export function getDefaultActiveTaskRunRegistry(): ActiveTaskRunRegistry {
  return defaultActiveTaskRunRegistry;
}
