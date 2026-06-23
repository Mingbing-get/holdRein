import type { TaskTokenUsageDelta } from "./token-collection";

export interface TokenUsageSyncTarget {
  addTaskTokenUsage: (
    taskId: string,
    usage: TaskTokenUsageDelta
  ) => unknown;
}

export interface TokenUsageSync {
  flush: () => void;
  record: (usage: TaskTokenUsageDelta) => void;
}

export interface CreateTokenUsageSyncOptions {
  flushIntervalMs?: number;
  syncTarget: TokenUsageSyncTarget;
  taskId: string;
}

const DEFAULT_TOKEN_FLUSH_INTERVAL_MS = 5000;

export function createTokenUsageSync(
  options: CreateTokenUsageSyncOptions
): TokenUsageSync {
  let pendingInputToken = 0;
  let pendingOutputToken = 0;
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  const flushIntervalMs =
    options.flushIntervalMs ?? DEFAULT_TOKEN_FLUSH_INTERVAL_MS;

  const scheduleFlush = () => {
    if (flushTimer !== undefined) return;

    flushTimer = setTimeout(() => {
      flushTimer = undefined;
      flush();
    }, flushIntervalMs);
  };

  const flush = () => {
    if (flushTimer !== undefined) {
      clearTimeout(flushTimer);
      flushTimer = undefined;
    }

    if (pendingInputToken === 0 && pendingOutputToken === 0) {
      return;
    }

    const usage = {
      inputToken: pendingInputToken,
      outputToken: pendingOutputToken
    };
    pendingInputToken = 0;
    pendingOutputToken = 0;

    try {
      options.syncTarget.addTaskTokenUsage(options.taskId, usage);
    } catch {
      pendingInputToken += usage.inputToken;
      pendingOutputToken += usage.outputToken;
      scheduleFlush();
    }
  };

  return {
    flush,
    record: (usage) => {
      pendingInputToken += usage.inputToken;
      pendingOutputToken += usage.outputToken;
      scheduleFlush();
    }
  };
}
