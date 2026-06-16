import { Divider, Flex } from "antd";
import {
  Sender as ASender,
  Suggestion,
  type SenderProps
} from "@ant-design/x";
import type { WebPlugin } from "@hold-rein/plugin-web";
import { useMemo } from "react";

import { useAppPlugins } from "../../../app/app-plugin";
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

export const CHAT_WORKSPACE_SUGGESTION_POPUP_CLASS =
  "chat-workspace-suggestion-popup";

interface Props extends Pick<SenderProps, 'autoSize' | 'className' | 'classNames' | 'disabled' | 'placeholder'> {
  activeAgent?: SelectedModel | null
  apiBaseUrl: string
  running?: boolean
  suggestionGroups?: WebPlugin.SuggestionGroup[]
  onActiveAgentChange?: (activeAgent: SelectedModel) => void
  onCancel?: () => Promise<void> | void
  onSubmit?: (...args: Parameters<Required<SenderProps>['onSubmit']>) => Promise<void> | void
  onMessageChange?: (message: string) => void
}

export default function Sender({
  activeAgent,
  apiBaseUrl,
  running = false,
  onCancel,
  onActiveAgentChange,
  suggestionGroups,
  onMessageChange,
  onSubmit,
  ...senderProps
}: Props) {
  const { senderActions, senderSuggestions } = useAppPlugins();
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
  const mergedSuggestionGroups = useMemo(
    () => [
      ...(suggestionGroups ?? []),
      ...senderSuggestions
    ],
    [senderSuggestions, suggestionGroups]
  );
  
  const {
    closeSuggestions,
    currentTrigger,
    getItemsByQuery,
    getTriggerQuery,
    openSuggestionForTrigger,
    setSuggestionOpen,
    suggestionOpen
  } = useSenderSuggestions({
    suggestionGroups: mergedSuggestionGroups
  });

  const disabled = useMemo(() => senderProps.disabled || !draftMessage?.length, [senderProps.disabled, draftMessage])

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
                footer={(_, { components: { SendButton, LoadingButton } }) => {
                  let action: React.ReactNode = null
                  if (running) {
                    action = (
                      <LoadingButton
                        aria-label="中断执行"
                        disabled={loading || !onCancel}
                        size="small"
                        onClick={() => {
                          void onCancel?.();
                        }}
                      />
                    )
                  } else if (loading) {
                    action = <LoadingButton size="small" />
                  } else {
                    action = <SendButton size="small" disabled={disabled} />
                  }

                  return (
                    <Flex align="center" justify="space-between" gap={8}>
                      <Flex
                        align="center"
                        data-testid="sender-footer-tools"
                      >
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
                        {senderActions.length ? (
                          <>
                            <Divider
                              orientation="vertical"
                              style={{
                                borderColor:
                                  "var(--app-color-border-secondary)"
                              }}
                            />
                            {senderActions.map(({ id, Render }) => (
                              <Render
                                changeMessage={handleChangeMessage}
                                draftMessage={draftMessage}
                                insertText={insertText}
                                key={id}
                              />
                            ))}
                          </>
                        ) : null}
                      </Flex>
                      {action}
                    </Flex>
                  );
                }}
                ref={senderRef}
                suffix={false}
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
