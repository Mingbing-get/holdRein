import { useCallback, useRef, useState } from "react";
import { Flex } from "antd";
import {
  Sender as ASender,
  Suggestion,
  type SenderProps
} from "@ant-design/x";

export interface SuggestionItem {
  label: string;
  value: string;
  icon?: React.ReactNode;
  children?: SuggestionItem[];
  extra?: React.ReactNode;
}

export interface SuggestionGroup {
  trigger: string;
  suggestions: SuggestionItem[]
}

export const CHAT_WORKSPACE_SUGGESTION_POPUP_CLASS =
  "chat-workspace-suggestion-popup";

interface SuggestionTrigger {
  trigger: SuggestionGroup['trigger']
  query: string
}

type SenderInstance = React.ElementRef<typeof ASender>;
type CursorSource = {
  selectionStart?: number | null;
} | null | undefined;
type InputElement = HTMLTextAreaElement | null;
interface SpaceKeydownSource {
  code?: string;
  isComposing?: boolean;
  nativeEvent?: {
    isComposing?: boolean;
  };
}

export function getCurrentCursorCharacterIndex(
  source: CursorSource
): number | null {
  return source?.selectionStart ?? null;
}

export function shouldHandleSpaceKeydown(
  event: SpaceKeydownSource
): boolean {
  if (event.code !== "Space") {
    return false;
  }

  return !(event.isComposing || event.nativeEvent?.isComposing);
}

function clampCursorIndex(value: string, cursorIndex: number | null): number {
  if (cursorIndex == null) {
    return value.length;
  }

  return Math.min(Math.max(cursorIndex, 0), value.length);
}

export function insertTextAtCursor(
  value: string,
  cursorIndex: number | null,
  insertedText: string
): string {
  const safeCursorIndex = clampCursorIndex(value, cursorIndex);

  return (
    value.slice(0, safeCursorIndex) +
    insertedText +
    value.slice(safeCursorIndex)
  );
}

export function replaceTriggerAtCursor(
  value: string,
  cursorIndex: number | null,
  currentTriggerText: string,
  replacementText: string
): string {
  const safeCursorIndex = clampCursorIndex(value, cursorIndex);
  const triggerStartIndex = safeCursorIndex - currentTriggerText.length;

  if (
    triggerStartIndex >= 0 &&
    value.slice(triggerStartIndex, safeCursorIndex) === currentTriggerText
  ) {
    return (
      value.slice(0, triggerStartIndex) +
      replacementText +
      value.slice(safeCursorIndex)
    );
  }

  return insertTextAtCursor(value, safeCursorIndex, replacementText);
}

interface Props extends Pick<SenderProps, 'autoSize' | 'className' | 'classNames' | 'disabled' | 'placeholder' | 'footer'> {
  suggestionGroups?: SuggestionGroup[]
  onSubmit?: (...args: Parameters<Required<SenderProps>['onSubmit']>) => Promise<void> | void
  onMessageChange?: (message: string) => void
}

export default function Sender({ suggestionGroups, onMessageChange, onSubmit, ...senderProps }: Props) {
  const [draftMessage, setDraftMessage] = useState("");
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [loading, setLoading] = useState(false)
  const currentTrigger = useRef<SuggestionTrigger>(null)
  const senderRef = useRef<SenderInstance>(null);

  const getCurrentCursorIndex = useCallback(
    () =>
      getCurrentCursorCharacterIndex(
        (senderRef.current?.inputElement as CursorSource) ?? null
      ),
    []
  );

  const focusCursorAt = useCallback((cursorIndex: number) => {
    requestAnimationFrame(() => {
      const inputElement = senderRef.current?.inputElement as InputElement;
      inputElement?.focus();
      inputElement?.setSelectionRange(cursorIndex, cursorIndex);
    });
  }, []);

  const handleChangeMessage = useCallback((v: string) => {
    setDraftMessage(v)
    onMessageChange?.(v)
  }, [onMessageChange])

  const handleAppendSpace = useCallback((e: React.KeyboardEvent) => {
    e.preventDefault();

    const cursorIndex =
      getCurrentCursorCharacterIndex(e.currentTarget as CursorSource) ??
      getCurrentCursorIndex();
    const nextMessage = insertTextAtCursor(draftMessage, cursorIndex, " ");
    const nextCursorIndex = clampCursorIndex(draftMessage, cursorIndex) + 1;

    handleChangeMessage(nextMessage);
    focusCursorAt(nextCursorIndex);
  }, [draftMessage, focusCursorAt, getCurrentCursorIndex, handleChangeMessage])

  const getItemsByQuery = useCallback((trigger?: SuggestionTrigger): SuggestionItem[] => {
    if (!trigger || !suggestionGroups?.length) return []

    for (const group of suggestionGroups) {
      if (group.trigger === trigger.trigger) {
        return group.suggestions.filter(item => item.label.includes(trigger.query))
      }
    }

    return []
  }, [suggestionGroups])

  const getTriggerQuery = useCallback((value: string, cursorIndex?: number | null): SuggestionTrigger | undefined => {
    if (!value || !suggestionGroups?.length) return

    const textBeforeCursor =
      cursorIndex == null ? value : value.slice(0, cursorIndex);

    if (textBeforeCursor.length === 1) {
      for (const group of suggestionGroups) {
        if (group.trigger === textBeforeCursor) {
          return {
            trigger: group.trigger,
            query: ''
          }
        }
      }
      return
    }

    const splitValues = textBeforeCursor.split(' ')
    const matchValue = splitValues[splitValues.length - 1]
    if (!matchValue) return

    for (const group of suggestionGroups) {
      if (matchValue.startsWith(`${group.trigger}`)) {
        const trigger: SuggestionTrigger = {
          trigger: group.trigger,
          query: matchValue.substring(1)
        }

        const items = getItemsByQuery(trigger)
        if (!items?.length) return

        return trigger
      }
    }
  }, [suggestionGroups, getItemsByQuery])

  const handleSubmit = useCallback(async (...args: Parameters<Required<SenderProps>['onSubmit']>) => {
    setLoading(true)

    try {
      await onSubmit?.(...args)

      setDraftMessage('')
    } finally {
      setLoading(false)
    }
  }, [onSubmit])

  return (
    <Flex vertical>
      <Suggestion<SuggestionTrigger>
        classNames={{
          popup: CHAT_WORKSPACE_SUGGESTION_POPUP_CLASS
        }}
        getPopupContainer={(triggerNode) =>
          triggerNode.parentElement ?? document.body
        }
        items={(info) => getItemsByQuery(info)}
        onOpenChange={setSuggestionOpen}
        onSelect={(value) => {
          const cursorIndex = getCurrentCursorIndex();
          const activeTrigger = currentTrigger.current;
          const triggerText = activeTrigger
            ? `${activeTrigger.trigger}${activeTrigger.query}`
            : "";
          const nextMessage = triggerText
            ? replaceTriggerAtCursor(draftMessage, cursorIndex, triggerText, value)
            : insertTextAtCursor(draftMessage, cursorIndex, value);
          const nextCursorIndex =
            triggerText && cursorIndex != null
              ? cursorIndex - triggerText.length + value.length
              : clampCursorIndex(draftMessage, cursorIndex) + value.length;

          handleChangeMessage(nextMessage);
          focusCursorAt(nextCursorIndex);
          setSuggestionOpen(false);
          currentTrigger.current = null;
        }}
        open={suggestionOpen}
        styles={{
          popup: {
            border: "1px solid var(--app-color-border-secondary)",
            borderRadius: 16,
            boxShadow:
              "0 18px 36px color-mix(in srgb, var(--app-color-shadow) 32%, transparent)"
          },
          root: {
            width: "100%"
          }
        }}
      >
        {({ onTrigger, onKeyDown }) => (
          (() => {
            return (
              <ASender
                {...senderProps}
                loading={loading}
                classNames={{
                  input: "chat-workspace-sender-input"
                }}
                onChange={(nextValue, e) => {
                  const cursorIndex =
                    getCurrentCursorCharacterIndex(e?.currentTarget ?? null) ??
                    getCurrentCursorIndex();
                  handleChangeMessage(nextValue);

                  const trigger = getTriggerQuery(nextValue, cursorIndex)

                  if (trigger) {
                    currentTrigger.current = trigger
                    setSuggestionOpen(true);
                    onTrigger(trigger);

                    return;
                  }

                  setSuggestionOpen(false);
                }}
                styles={{
                  content: {
                    background: "var(--app-color-bg-elevated)",
                    borderRadius: 20
                  },
                  input: {
                    caretColor: "var(--app-color-text)",
                    color: "var(--app-color-text)"
                  },
                  root: {
                    background: "var(--app-color-bg-elevated)",
                    border: "1px solid var(--app-color-border-secondary)",
                    borderRadius: 20,
                    boxShadow:
                      "0 14px 32px color-mix(in srgb, var(--app-color-shadow) 20%, transparent)"
                  }
                }}
                ref={senderRef}
                value={draftMessage}
                onKeyDown={e => {
                  if (shouldHandleSpaceKeydown(e)) {
                    handleAppendSpace(e)
                    return;
                  }
                  onKeyDown(e)
                }}
                onSubmit={handleSubmit}
              />
            );
          })()
        )}
      </Suggestion>
    </Flex>
  )
}
