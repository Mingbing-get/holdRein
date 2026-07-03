import { randomUUID } from "node:crypto";

import type { AgentHarness } from "@earendil-works/pi-agent-core/node";
import type { ServerPlugin } from "@hold-rein/plugin-server";

import type { AgentEventBus } from "../event/event-bus";
import { toStoredAgentMessage } from "../message/storage";
import { extractAssistantText, type SubagentRun } from "../subagent";
import { appendVisibleCustomMessage } from "./messages";
import { flushPendingSubagentResults } from "./subagent-results";
import type {
  HarnessSession,
  PendingVisibleCustomMessage,
  CreateHarnessOptions
} from "./type";
import type { ModelProxyRuntimeController } from "../../model-proxies/model-proxy-runtime";

export interface SubscribeHarnessEventsInput {
  contribution: ServerPlugin.Contribution;
  continueOrEndTask: (
    agentId: string,
    agentName: string | undefined,
    session: HarnessSession,
    contribution: ServerPlugin.Contribution
  ) => Promise<boolean>;
  eventBus: AgentEventBus;
  finishSubagent: (
    agentId: string,
    contribution: ServerPlugin.Contribution
  ) => Promise<void>;
  getProxyController: () => ModelProxyRuntimeController | undefined;
  harness: AgentHarness;
  harnessOptions: CreateHarnessOptions;
  interruptedHarnesses: WeakSet<AgentHarness>;
  pendingSubagentResults: Map<string, Set<string>>;
  pendingVisibleMessages: Map<string, PendingVisibleCustomMessage[]>;
  subagents: Map<string, SubagentRun<HarnessSession>>;
}

export function subscribeHarnessEvents(
  input: SubscribeHarnessEventsInput
): void {
  let activeMessageId: string | undefined;
  const { contribution, eventBus, harness, harnessOptions } = input;

  harness.subscribe(async (event) => {
    try {
      contribution.subscribe?.(event);
    } catch {
      // Keep plugin subscriber failures from breaking agent event delivery.
    }
    if (event.type === "message_start") {
      activeMessageId = `message_${randomUUID()}`;
      eventBus.emit({
        agentId: harnessOptions.agentId,
        payload: { message: toStoredAgentMessage(activeMessageId, event.message) },
        type: "message_start"
      });
      return;
    }
    if (event.type === "message_update" && activeMessageId) {
      eventBus.emit({
        agentId: harnessOptions.agentId,
        payload: {
          delta: event.assistantMessageEvent,
          messageId: activeMessageId
        },
        type: "message_delta"
      });
      return;
    }
    if (event.type === "message_end") {
      const messageId = activeMessageId ?? `message_${randomUUID()}`;
      const message = toStoredAgentMessage(messageId, event.message);
      const subagent = input.subagents.get(harnessOptions.agentId);
      if (subagent) {
        subagent.lastAssistantText = extractAssistantText(event.message);
      }
      eventBus.emit({
        agentId: harnessOptions.agentId,
        payload: { message },
        type: "message_end"
      });
      activeMessageId = undefined;
      const proxyController = input.getProxyController();
      if (proxyController && event.message.role === "assistant") {
        try {
          await proxyController.recordAssistantUsage({
            inputToken: event.message.usage?.input ?? 0,
            modelId: event.message.model,
            outputToken: event.message.usage?.output ?? 0,
            provider: event.message.provider
          });
        } catch (error) {
          eventBus.emit({
            agentId: harnessOptions.agentId,
            payload: {
              message: error instanceof Error
                ? error.message
                : "Proxy fallback unavailable"
            },
            type: "agent_error"
          });
        }
      }
      if (event.message.role === "toolResult") {
        await flushVisibleToolMessages(input, event.message.toolCallId);
      }
      return;
    }
    if (event.type === "agent_end") {
      eventBus.emit({ agentId: harnessOptions.agentId, type: "agent_end" });
      if (input.interruptedHarnesses.has(harness)) return;
      if (harnessOptions.parentAgentId) {
        await input.finishSubagent(harnessOptions.agentId, contribution);
        return;
      }
      const continued = await input.continueOrEndTask(
        harnessOptions.agentId,
        harnessOptions.agentName,
        harnessOptions.session,
        contribution
      );
      if (!continued) {
        eventBus.emit({ agentId: harnessOptions.agentId, type: "task_end" });
      }
    }
  });
}

async function flushVisibleToolMessages(
  input: SubscribeHarnessEventsInput,
  toolCallId: string
): Promise<void> {
  const pendingMessages = input.pendingVisibleMessages.get(toolCallId);
  if (pendingMessages) {
    for (const pendingMessage of pendingMessages) {
      await appendVisibleCustomMessage({
        agentId: input.harnessOptions.agentId,
        ...pendingMessage,
        eventBus: input.eventBus,
        session: input.harnessOptions.session
      });
    }
    input.pendingVisibleMessages.delete(toolCallId);
  }
  await flushPendingSubagentResults({
    agentId: input.harnessOptions.agentId,
    eventBus: input.eventBus,
    pendingSubagentResults: input.pendingSubagentResults,
    session: input.harnessOptions.session,
    subagents: input.subagents
  });
}
