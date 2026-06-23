import type { AgentHarnessEvent } from "@earendil-works/pi-agent-core";

export interface TaskTokenUsage {
  inputToken: number;
  outputToken: number;
  taskId: string;
}

export interface TaskTokenUsageDelta {
  inputToken: number;
  outputToken: number;
}

export interface TokenCollection {
  appendHarness: (harness: TokenCollectableHarness) => void;
  getUsage: () => TaskTokenUsage;
}

interface TokenCollectableHarness {
  subscribe: (
    listener: (event: AgentHarnessEvent, signal?: AbortSignal) => Promise<void> | void
  ) => () => void;
}

export interface CreateTokenCollectionOptions {
  onUsage?: (usage: TaskTokenUsageDelta) => void;
  onUsageEnd?: () => void;
}

export function createTokenCollection(
  taskId: string,
  options: CreateTokenCollectionOptions = {}
): TokenCollection {
  let inputToken = 0;
  let outputToken = 0;
  const subscriptions = new Map<TokenCollectableHarness, () => void>();

  return {
    appendHarness: (harness) => {
      if (subscriptions.has(harness)) return;

      const unsubscribe = harness.subscribe((event) => {
        if (!subscriptions.has(harness)) return;

        if (event.type === "message_end") {
          const usage = event.message.role === "assistant"
            ? event.message.usage
            : undefined;
          const usageDelta = {
            inputToken: usage?.input ?? 0,
            outputToken: usage?.output ?? 0
          };
          inputToken += usageDelta.inputToken;
          outputToken += usageDelta.outputToken;
          if (usageDelta.inputToken > 0 || usageDelta.outputToken > 0) {
            options.onUsage?.(usageDelta);
          }
          return;
        }

        if (event.type === "agent_end") {
          subscriptions.get(harness)?.();
          subscriptions.delete(harness);
          options.onUsageEnd?.();
        }
      });
      subscriptions.set(harness, unsubscribe);
    },
    getUsage: () => ({
      inputToken,
      outputToken,
      taskId
    })
  };
}
