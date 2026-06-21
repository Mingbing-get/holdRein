import { useMemo } from "react";

import type { AgentTaskState, SubagentState } from "../agent-message-types";
import type { WebPlugin } from "@hold-rein/plugin-web";

export interface TurnFooterMessageGroup {
  beforeAssistantId: string;
  messages: WebPlugin.AgentMessage[];
}

export type TurnFooterStatus =
  | AgentTaskState["status"]
  | SubagentState["status"]
  | undefined;

export function useTurnFooterMessageGroups(
  messages: WebPlugin.AgentMessage[],
  status: TurnFooterStatus
): TurnFooterMessageGroup[] {
  return useMemo(
    () => getTurnFooterMessageGroups(messages, status),
    [messages, status]
  );
}

export function getTurnFooterMessageGroups(
  messages: WebPlugin.AgentMessage[],
  status: TurnFooterStatus
): TurnFooterMessageGroup[] {
  const groups: TurnFooterMessageGroup[] = [];
  let turnMessages: WebPlugin.AgentMessage[] = [];
  let assistantId: string | undefined;

  for (const message of messages) {
    if (message.role === "user" && turnMessages.length > 0) {
      appendCompletedTurn(groups, turnMessages, assistantId);
      turnMessages = [];
      assistantId = undefined;
    }

    turnMessages.push(message);

    if (message.role === "assistant") {
      assistantId = message.id;
    }
  }

  if (status !== "running") {
    appendCompletedTurn(groups, turnMessages, assistantId);
  }

  return groups;
}

function appendCompletedTurn(
  groups: TurnFooterMessageGroup[],
  messages: WebPlugin.AgentMessage[],
  assistantId: string | undefined
): void {
  if (!assistantId) return;
  groups.push({
    beforeAssistantId: assistantId,
    messages
  });
}
