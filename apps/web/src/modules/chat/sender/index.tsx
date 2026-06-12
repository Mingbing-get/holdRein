import { Divider, Flex } from "antd";
import {
  Sender as ASender,
  Suggestion,
  type SenderProps
} from "@ant-design/x";

import { ModelSelector, type SelectedModel } from "../model-selector";
import { WorkspaceSelector } from "../workspace-selector";
import {
  useSenderInputState,
  useSenderSuggestions,
  type SuggestionTrigger
} from "./hooks";
import {
  getCurrentCursorCharacterIndex,
  shouldHandleSpaceKeydown,
  shouldHandleSuggestionEnterKeydown
} from "./utils";

export {
  clampCursorIndex,
  getCurrentCursorCharacterIndex,
  insertTextAtCursor,
  replaceTriggerAtCursor,
  shouldHandleSpaceKeydown,
  shouldHandleSuggestionEnterKeydown,
  type CursorSource
} from "./utils";

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

interface Props extends Pick<SenderProps, 'autoSize' | 'className' | 'classNames' | 'disabled' | 'placeholder'> {
  activeAgent?: SelectedModel | null
  apiBaseUrl: string
  suggestionGroups?: SuggestionGroup[]
  onActiveAgentChange?: (activeAgent: SelectedModel) => void
  onSubmit?: (...args: Parameters<Required<SenderProps>['onSubmit']>) => Promise<void> | void
  onMessageChange?: (message: string) => void
}

export default function Sender({
  activeAgent,
  apiBaseUrl,
  onActiveAgentChange,
  suggestionGroups,
  onMessageChange,
  onSubmit,
  ...senderProps
}: Props) {
  const {
    draftMessage,
    handleChangeMessage,
    handleSubmit,
    insertText,
    loading,
    senderRef
  } = useSenderInputState({
    onMessageChange,
    onSubmit
  });
  
  const {
    closeSuggestions,
    currentTrigger,
    getItemsByQuery,
    getTriggerQuery,
    openSuggestionForTrigger,
    setSuggestionOpen,
    suggestionOpen
  } = useSenderSuggestions({
    suggestionGroups
  });

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
          const activeTrigger = currentTrigger.current;
          const overwriteLength = activeTrigger
            ? `${activeTrigger.trigger}${activeTrigger.query}`.length
            : 0;

          insertText(value, overwriteLength);
          closeSuggestions();
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
                    getCurrentCursorCharacterIndex(e?.currentTarget ?? null);
                  handleChangeMessage(nextValue);

                  const trigger = getTriggerQuery(nextValue, cursorIndex)

                  if (trigger) {
                    openSuggestionForTrigger(trigger);
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
                footer={
                  <Flex align="center">
                    <WorkspaceSelector apiBaseUrl={apiBaseUrl} />
                    <Divider
                      orientation="vertical"
                      style={{
                        borderColor: "var(--app-color-border-secondary)"
                      }}
                    />
                    <ModelSelector
                      apiBaseUrl={apiBaseUrl}
                      value={activeAgent ?? undefined}
                      {...(onActiveAgentChange
                        ? { onChange: onActiveAgentChange }
                        : {})}
                    />
                  </Flex>
                }
                ref={senderRef}
                value={draftMessage}
                onKeyDown={e => {
                  if (shouldHandleSpaceKeydown(e)) {
                    e.preventDefault();
                    insertText(" ");
                    return;
                  }
                  if (shouldHandleSuggestionEnterKeydown(e, suggestionOpen)) {
                    onKeyDown(e);
                    e.preventDefault();
                    return false;
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
