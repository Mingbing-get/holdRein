import { useCallback, useMemo, useState } from "react";
import type { SenderImageAttachmentItem } from "../image-attachments";

interface SenderDraft {
  imageAttachments: SenderImageAttachmentItem[];
  message: string;
}

const emptyDraft: SenderDraft = {
  imageAttachments: [],
  message: ""
};

const senderDrafts = new Map<string, Map<string, SenderDraft>>();

export interface UseSenderDraftOptions {
  draftKey?: string | undefined;
  taskId?: string | undefined;
  workspacePath?: string | undefined;
}

export interface UseSenderDraftResult {
  draftImageAttachments: SenderImageAttachmentItem[];
  draftMessage: string;
  clearDraft: () => void;
  setDraftImageAttachments: (items: SenderImageAttachmentItem[]) => void;
  setDraftMessage: (message: string) => void;
}

interface SenderDraftState {
  draft: SenderDraft;
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
    draft: readDraft(draftKey, draftSlotKey),
    draftSlotKey
  }));
  const draft =
    draftState.draftSlotKey === draftSlotKey
      ? draftState.draft
      : readDraft(draftKey, draftSlotKey);

  const setDraftMessage = useCallback(
    (message: string) => {
      setDraftState((currentState) => {
        const currentDraft = currentState.draftSlotKey === draftSlotKey
          ? currentState.draft
          : readDraft(draftKey, draftSlotKey);
        const nextDraft = {
          ...currentDraft,
          message
        };

        writeDraft(draftKey, draftSlotKey, nextDraft);

        return {
          draft: nextDraft,
          draftSlotKey
        };
      });
    },
    [draftKey, draftSlotKey]
  );

  const setDraftImageAttachments = useCallback(
    (imageAttachments: SenderImageAttachmentItem[]) => {
      setDraftState((currentState) => {
        const currentDraft = currentState.draftSlotKey === draftSlotKey
          ? currentState.draft
          : readDraft(draftKey, draftSlotKey);
        const nextDraft = {
          ...currentDraft,
          imageAttachments
        };

        writeDraft(draftKey, draftSlotKey, nextDraft);

        return {
          draft: nextDraft,
          draftSlotKey
        };
      });
    },
    [draftKey, draftSlotKey]
  );

  const clearDraft = useCallback(() => {
    deleteDraft(draftKey, draftSlotKey);
    setDraftState({
      draft: emptyDraft,
      draftSlotKey
    });
  }, [draftKey, draftSlotKey]);

  return {
    clearDraft,
    draftImageAttachments: draft.imageAttachments,
    draftMessage: draft.message,
    setDraftImageAttachments,
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
): SenderDraft {
  if (!draftKey || !draftSlotKey) {
    return emptyDraft;
  }

  return senderDrafts.get(draftKey)?.get(draftSlotKey) ?? emptyDraft;
}

function writeDraft(
  draftKey: string | undefined,
  draftSlotKey: string,
  draft: SenderDraft
): void {
  if (!draftKey || !draftSlotKey) {
    return;
  }

  if (!draft.message && !draft.imageAttachments.length) {
    deleteDraft(draftKey, draftSlotKey);
    return;
  }

  const draftsBySlot =
    senderDrafts.get(draftKey) ?? new Map<string, SenderDraft>();
  draftsBySlot.set(draftSlotKey, draft);
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
