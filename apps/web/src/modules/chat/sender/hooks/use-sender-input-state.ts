import { useCallback, useRef, useState, type RefObject } from "react";
import type { Sender as ASender, SenderProps } from "@ant-design/x";

import {
  clampCursorIndex,
  getCurrentCursorCharacterIndex
} from "../utils";
import { useSenderDraft } from "./use-sender-draft";

type SenderSubmitHandler = Required<SenderProps>["onSubmit"];
type SenderInstance = React.ElementRef<typeof ASender>;
type InputElement = HTMLTextAreaElement | null;

export interface UseSenderInputStateOptions {
  draftKey?: string | undefined;
  onMessageChange?: ((message: string) => void) | undefined;
  onSubmit?:
    | ((...args: Parameters<SenderSubmitHandler>) => Promise<void> | void)
    | undefined;
  taskId?: string | undefined;
  workspacePath?: string | undefined;
}

export interface UseSenderInputStateResult {
  draftMessage: string;
  loading: boolean;
  senderRef: RefObject<SenderInstance | null>;
  handleChangeMessage: (message: string) => void;
  handleSubmit: (...args: Parameters<SenderSubmitHandler>) => Promise<void>;
  insertText: (insertedText: string, overwriteLength?: number) => void;
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
    draftMessage,
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
    ...args: Parameters<SenderSubmitHandler>
  ) => {
    setLoading(true);

    try {
      await onSubmit?.(...args);
      clearDraft();
    } finally {
      setLoading(false);
    }
  }, [clearDraft, onSubmit]);

  return {
    draftMessage,
    handleChangeMessage,
    handleSubmit,
    insertText,
    senderRef,
    loading
  };
}
