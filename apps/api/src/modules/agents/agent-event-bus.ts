import type {
  AgentEventEnvelope,
  AgentEventSubscription,
  SubscribeAgentEventsInput
} from "./agent-types";

export type AgentEventListener = (event: AgentEventEnvelope) => void;

export interface AgentEventBus {
  emit: (event: Omit<AgentEventEnvelope, "sequence" | "timestamp">) => void;
  subscribe: (
    input: SubscribeAgentEventsInput,
    listener: AgentEventListener
  ) => AgentEventSubscription;
}

export function createAgentEventBus(): AgentEventBus {
  const listeners = new Map<string, Set<AgentEventListener>>();
  const events = new Map<string, AgentEventEnvelope[]>();
  const sequences = new Map<string, number>();

  return {
    emit: (event) => {
      const sequence = (sequences.get(event.agentId) ?? 0) + 1;
      sequences.set(event.agentId, sequence);

      const envelope: AgentEventEnvelope = {
        ...event,
        sequence,
        timestamp: new Date().toISOString()
      };
      const agentEvents = events.get(event.agentId) ?? [];
      agentEvents.push(envelope);
      events.set(event.agentId, agentEvents);

      for (const listener of listeners.get(event.agentId) ?? []) {
        listener(envelope);
      }
    },
    subscribe: (input, listener) => {
      for (const event of events.get(input.agentId) ?? []) {
        if (event.sequence > (input.afterSequence ?? 0)) {
          listener(event);
        }
      }

      const agentListeners =
        listeners.get(input.agentId) ?? new Set<AgentEventListener>();
      agentListeners.add(listener);
      listeners.set(input.agentId, agentListeners);

      return {
        unsubscribe: () => {
          agentListeners.delete(listener);
          if (agentListeners.size === 0) {
            listeners.delete(input.agentId);
          }
        }
      };
    }
  };
}
