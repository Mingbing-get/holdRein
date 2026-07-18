import { useCallback, useRef, useState, type RefObject } from "react";
import type { Sender as ASender } from "@ant-design/x";
import type { ImageContent } from "../../../agent-messages/agent-message-types";

import {
  clampCursorIndex,
  getCurrentCursorCharacterIndex
} from "../utils";
import type { SenderImageAttachmentItem } from "../image-attachments";
import { useSenderDraft } from "./use-sender-draft";

type SenderInstance = React.ElementRef<typeof ASender>;
type InputElement = HTMLTextAreaElement | null;
type SenderSubmitHandler = (
  message: string,
  images?: ImageContent[]
) => Promise<void> | void;

export interface UseSenderInputStateOptions {
  draftKey?: string | undefined;
  onMessageChange?: ((message: string) => void) | undefined;
  onSubmit?: SenderSubmitHandler | undefined;
  taskId?: string | undefined;
  workspacePath?: string | undefined;
}

export interface UseSenderInputStateResult {
  draftImageAttachments: SenderImageAttachmentItem[];
  draftMessage: string;
  loading: boolean;
  senderRef: RefObject<SenderInstance | null>;
  handleChangeMessage: (message: string) => void;
  handleSubmit: (message: string, images?: ImageContent[]) => Promise<void>;
  insertText: (insertedText: string, overwriteLength?: number) => void;
  setDraftImageAttachments: (items: SenderImageAttachmentItem[]) => void;
}

export function useSenderInputState({
  draftKey,
  onMessageChange,
  onSubmit,
  taskId,
  workspacePath
}: UseSenderInputStateOptions): UseSenderInputStateResult {
  const [loading, setLoading] = useState(false);
  const senderRef = useRef<SenderInstance>(null);
  const {
    clearDraft,
    draftImageAttachments,
    draftMessage,
    setDraftImageAttachments,
    setDraftMessage
  } = useSenderDraft({
    draftKey,
    taskId,
    workspacePath
  });

  const handleChangeMessage = useCallback((message: string) => {
    setDraftMessage(message);
    onMessageChange?.(message);
  }, [onMessageChange, setDraftMessage]);

  const focusCursorAt = useCallback((cursorIndex: number) => {
    requestAnimationFrame(() => {
      const inputElement = senderRef.current?.inputElement as InputElement;
      inputElement?.focus();
      inputElement?.setSelectionRange(cursorIndex, cursorIndex);
    });
  }, []);

  const insertText = useCallback((
    insertedText: string,
    overwriteLength = 0
  ) => {
    const inputElement = senderRef.current?.inputElement as InputElement;
    const cursorIndex = clampCursorIndex(
      draftMessage,
      getCurrentCursorCharacterIndex(inputElement)
    );
    const replacementStartIndex = Math.max(
      0,
      cursorIndex - Math.max(overwriteLength, 0)
    );
    const nextMessage =
      draftMessage.slice(0, replacementStartIndex) +
      insertedText +
      draftMessage.slice(cursorIndex);
    const nextCursorIndex = replacementStartIndex + insertedText.length;

    handleChangeMessage(nextMessage);
    focusCursorAt(nextCursorIndex);
  }, [draftMessage, focusCursorAt, handleChangeMessage]);

  const handleSubmit = useCallback(async (
    message: string,
    images?: ImageContent[]
  ) => {
    setLoading(true);

    try {
      if (images === undefined) {
        await onSubmit?.(message);
      } else {
        await onSubmit?.(message, images);
      }
      clearDraft();
    } finally {
      setLoading(false);
    }
  }, [clearDraft, onSubmit]);

  return {
    draftImageAttachments,
    draftMessage,
    handleChangeMessage,
    handleSubmit,
    insertText,
    senderRef,
    loading,
    setDraftImageAttachments
  };
}
