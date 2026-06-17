import { useCallback, useMemo, useState } from "react";

const senderDrafts = new Map<string, Map<string, string>>();

export interface UseSenderDraftOptions {
  draftKey?: string | undefined;
  taskId?: string | undefined;
  workspacePath?: string | undefined;
}

export interface UseSenderDraftResult {
  draftMessage: string;
  clearDraft: () => void;
  setDraftMessage: (message: string) => void;
}

interface SenderDraftState {
  draftMessage: string;
  draftSlotKey: string;
}

export function useSenderDraft({
  draftKey,
  taskId,
  workspacePath
}: UseSenderDraftOptions): UseSenderDraftResult {
  const draftSlotKey = useMemo(
    () => getDraftSlotKey(taskId, workspacePath),
    [taskId, workspacePath]
  );
  const [draftState, setDraftState] = useState<SenderDraftState>(() => ({
    draftMessage: readDraft(draftKey, draftSlotKey),
    draftSlotKey
  }));
  const draftMessage =
    draftState.draftSlotKey === draftSlotKey
      ? draftState.draftMessage
      : readDraft(draftKey, draftSlotKey);

  const setDraftMessage = useCallback(
    (message: string) => {
      setDraftState({
        draftMessage: message,
        draftSlotKey
      });
      writeDraft(draftKey, draftSlotKey, message);
    },
    [draftKey, draftSlotKey]
  );

  const clearDraft = useCallback(() => {
    deleteDraft(draftKey, draftSlotKey);
    setDraftState({
      draftMessage: "",
      draftSlotKey
    });
  }, [draftKey, draftSlotKey]);

  return {
    clearDraft,
    draftMessage,
    setDraftMessage
  };
}

function getDraftSlotKey(
  taskId: string | undefined,
  workspacePath: string | undefined
): string {
  return taskId || workspacePath || "";
}

function readDraft(
  draftKey: string | undefined,
  draftSlotKey: string
): string {
  if (!draftKey || !draftSlotKey) {
    return "";
  }

  return senderDrafts.get(draftKey)?.get(draftSlotKey) ?? "";
}

function writeDraft(
  draftKey: string | undefined,
  draftSlotKey: string,
  message: string
): void {
  if (!draftKey || !draftSlotKey) {
    return;
  }

  if (!message) {
    deleteDraft(draftKey, draftSlotKey);
    return;
  }

  const draftsBySlot = senderDrafts.get(draftKey) ?? new Map<string, string>();
  draftsBySlot.set(draftSlotKey, message);
  senderDrafts.set(draftKey, draftsBySlot);
}

function deleteDraft(
  draftKey: string | undefined,
  draftSlotKey: string
): void {
  if (!draftKey || !draftSlotKey) {
    return;
  }

  const draftsBySlot = senderDrafts.get(draftKey);

  if (!draftsBySlot) {
    return;
  }

  draftsBySlot.delete(draftSlotKey);

  if (!draftsBySlot.size) {
    senderDrafts.delete(draftKey);
  }
}
