import {
  subscribeToAgentEvents,
  type AgentMessageFetcher
} from "./api";
import type { AgentEventEnvelope } from "./agent-message-types";
import type { WebPlugin } from "@hold-rein/plugin-web";
import type { RefObject } from "react";

export interface StartAgentEventSubscriptionInput {
  agentId: string;
  apiBaseUrl: string;
  fetcher: AgentMessageFetcher;
  onError: (error: unknown) => void;
  onEvent: (event: AgentEventEnvelope) => void;
  subscriptions: RefObject<Map<string, AbortController>>;
}

export function startAgentEventSubscription(
  input: StartAgentEventSubscriptionInput
): void {
  const controller = new AbortController();
  input.subscriptions.current.set(input.agentId, controller);

  void subscribeToAgentEvents(
    input.apiBaseUrl,
    { agentId: input.agentId, signal: controller.signal },
    input.onEvent,
    input.fetcher
  )
    .catch((error: unknown) => {
      if (controller.signal.aborted) return;
      input.onError(error);
    })
    .finally(() => {
      input.subscriptions.current.delete(input.agentId);
    });
}

export function getAgentEventMessage(
  event: AgentEventEnvelope
): WebPlugin.AgentMessage | undefined {
  if (event.type !== "message_start" && event.type !== "message_end") {
    return undefined;
  }
  const payload = event.payload;
  if (!payload || typeof payload !== "object") return undefined;
  return (payload as { message?: WebPlugin.AgentMessage }).message;
}
