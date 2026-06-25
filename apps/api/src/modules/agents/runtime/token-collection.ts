import type { AgentHarnessEvent } from "@earendil-works/pi-agent-core";
import type { NewModelTokenUsageHourlyRow, TaskRow } from "../../../db";

export interface TaskTokenUsageDelta {
  inputToken: number;
  outputToken: number;
}

export interface TokenUsageStorageTarget {
  addModelTokenUsageHourly: (usage: NewModelTokenUsageHourlyRow) => unknown;
  addTaskTokenUsage: (
    taskId: string,
    usage: Pick<TaskRow, "inputToken" | "outputToken">
  ) => unknown;
}

export interface TokenCollection {
  appendHarness: (harness: TokenCollectableHarness) => void;
  flush: () => void;
}

interface TokenCollectableHarness {
  subscribe: (
    listener: (event: AgentHarnessEvent, signal?: AbortSignal) => Promise<void> | void
  ) => () => void;
}

export interface CreateTokenCollectionOptions {
  flushIntervalMs?: number;
  storageTarget?: TokenUsageStorageTarget;
}

const DEFAULT_TOKEN_FLUSH_INTERVAL_MS = 5000;

export function createRuntimeTokenCollectionOptions(input: {
  tokenFlushIntervalMs?: number;
  tokenUsageStorageTarget?: TokenUsageStorageTarget;
}): CreateTokenCollectionOptions {
  if (!input.tokenUsageStorageTarget) return {};

  return {
    ...(input.tokenFlushIntervalMs === undefined
      ? {}
      : { flushIntervalMs: input.tokenFlushIntervalMs }),
    storageTarget: input.tokenUsageStorageTarget
  };
}

export function createTokenCollection(
  taskId: string,
  options: CreateTokenCollectionOptions = {}
): TokenCollection {
  let pendingInputToken = 0;
  let pendingOutputToken = 0;
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  const flushIntervalMs =
    options.flushIntervalMs ?? DEFAULT_TOKEN_FLUSH_INTERVAL_MS;
  const subscriptions = new Map<TokenCollectableHarness, () => void>();
  const pendingModelUsages = new Map<string, NewModelTokenUsageHourlyRow>();

  const scheduleFlush = () => {
    if (options.storageTarget === undefined || flushTimer !== undefined) return;

    flushTimer = setTimeout(() => {
      flushTimer = undefined;
      flush();
    }, flushIntervalMs);
  };

  const record = (usage: TaskTokenUsageDelta & {
    hour: string;
    modelName: string;
    provider: string;
  }) => {
    pendingInputToken += usage.inputToken;
    pendingOutputToken += usage.outputToken;

    const hour = toUsageHour(usage.hour);
    const key = `${usage.provider}\0${usage.modelName}\0${hour}`;
    const existingUsage = pendingModelUsages.get(key);
    pendingModelUsages.set(key, {
      hour,
      inputToken: (existingUsage?.inputToken ?? 0) + usage.inputToken,
      modelName: usage.modelName,
      outputToken: (existingUsage?.outputToken ?? 0) + usage.outputToken,
      provider: usage.provider
    });

    scheduleFlush();
  };

  const requeueModelUsage = (usage: NewModelTokenUsageHourlyRow) => {
    const key = `${usage.provider}\0${usage.modelName}\0${usage.hour}`;
    const existingUsage = pendingModelUsages.get(key);
    pendingModelUsages.set(key, {
      ...usage,
      inputToken: (existingUsage?.inputToken ?? 0) + (usage.inputToken ?? 0),
      outputToken: (existingUsage?.outputToken ?? 0) + (usage.outputToken ?? 0)
    });
  };

  function flush() {
    if (flushTimer !== undefined) {
      clearTimeout(flushTimer);
      flushTimer = undefined;
    }

    const storageTarget = options.storageTarget;
    if (storageTarget === undefined) return;

    const taskUsage = {
      inputToken: pendingInputToken,
      outputToken: pendingOutputToken
    };
    const modelUsages = [...pendingModelUsages.values()];
    pendingInputToken = 0;
    pendingOutputToken = 0;
    pendingModelUsages.clear();

    if (taskUsage.inputToken > 0 || taskUsage.outputToken > 0) {
      try {
        storageTarget.addTaskTokenUsage(taskId, taskUsage);
      } catch {
        pendingInputToken += taskUsage.inputToken;
        pendingOutputToken += taskUsage.outputToken;
      }
    }

    for (const modelUsage of modelUsages) {
      try {
        storageTarget.addModelTokenUsageHourly(modelUsage);
      } catch {
        requeueModelUsage(modelUsage);
      }
    }

    if (
      pendingInputToken > 0 ||
      pendingOutputToken > 0 ||
      pendingModelUsages.size > 0
    ) {
      scheduleFlush();
    }
  }

  return {
    appendHarness: (harness) => {
      if (subscriptions.has(harness)) return;

      const unsubscribe = harness.subscribe((event) => {
        if (!subscriptions.has(harness)) return;

        if (event.type === "message_end") {
          if (event.message.role !== "assistant") {
            return;
          }

          const usage = event.message.usage;
          const usageDelta = {
            inputToken: usage?.input ?? 0,
            outputToken: usage?.output ?? 0
          };
          if (usageDelta.inputToken > 0 || usageDelta.outputToken > 0) {
            record({
              ...usageDelta,
              hour: new Date(event.message.timestamp).toISOString(),
              modelName: event.message.model,
              provider: event.message.provider
            });
          }
          return;
        }

        if (event.type === "agent_end") {
          subscriptions.get(harness)?.();
          subscriptions.delete(harness);
          flush();
        }
      });
      subscriptions.set(harness, unsubscribe);
    },
    flush
  };
}

function toUsageHour(value: string): string {
  const date = new Date(value);
  date.setUTCMinutes(0, 0, 0);

  return date.toISOString();
}
