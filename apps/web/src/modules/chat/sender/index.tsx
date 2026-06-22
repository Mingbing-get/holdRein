import { Divider, Flex } from "antd";
import {
  Sender as ASender,
  type SenderProps
} from "@ant-design/x";
import type { WebPlugin } from "@hold-rein/plugin-web";
import { useCallback, useEffect, useMemo, useState } from "react";

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
import {
  flattenSuggestionItems,
  SenderSuggestionPopup
} from "./suggestion-popup";

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
  draftKey?: string | undefined
  running?: boolean
  suggestionGroups?: WebPlugin.SuggestionGroup[] | undefined
  taskId?: string | undefined
  onActiveAgentChange?: (activeAgent: SelectedModel) => void
  onCancel?: () => Promise<void> | void
  onSubmit?: (...args: Parameters<Required<SenderProps>['onSubmit']>) => Promise<void> | void
  onMessageChange?: (message: string) => void
  workspacePath?: string | undefined
}

export default function Sender({
  activeAgent,
  apiBaseUrl,
  draftKey,
  running = false,
  onCancel,
  onActiveAgentChange,
  suggestionGroups,
  taskId,
  onMessageChange,
  onSubmit,
  workspacePath,
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
    draftKey,
    onMessageChange,
    onSubmit,
    taskId,
    workspacePath
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
    getGroupsByQuery,
    getTriggerQuery,
    openSuggestionForTrigger,
    setSuggestionOpen,
    suggestionOpen
  } = useSenderSuggestions({
    suggestionGroups: mergedSuggestionGroups
  });

  const disabled = useMemo(() => senderProps.disabled || !draftMessage?.length, [senderProps.disabled, draftMessage])
  const activeSuggestionGroups = suggestionOpen
    ? getGroupsByQuery(currentTrigger.current ?? undefined)
    : [];
  const selectableSuggestionItems = useMemo(
    () => flattenSuggestionItems(activeSuggestionGroups),
    [activeSuggestionGroups]
  );
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);

  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [draftMessage, suggestionOpen]);

  const selectSuggestionValue = useCallback((value: string) => {
    const activeTrigger = currentTrigger.current;
    const overwriteLength = activeTrigger
      ? `${activeTrigger.trigger}${activeTrigger.query}`.length
      : 0;

    insertText(value, overwriteLength);
    closeSuggestions();
  }, [closeSuggestions, currentTrigger, insertText]);

  return (
    <Flex
      vertical
      style={{
        position: "relative",
        width: "100%"
      }}
    >
      {suggestionOpen && activeSuggestionGroups.length ? (
        <SenderSuggestionPopup
          activeIndex={activeSuggestionIndex}
          className={CHAT_WORKSPACE_SUGGESTION_POPUP_CLASS}
          groups={activeSuggestionGroups}
          onSelect={selectSuggestionValue}
        />
      ) : null}
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
                  if (suggestionOpen && selectableSuggestionItems.length) {
                    if (e.key === "ArrowDown" || e.code === "ArrowDown") {
                      e.preventDefault();
                      setActiveSuggestionIndex((currentIndex) =>
                        (currentIndex + 1) % selectableSuggestionItems.length
                      );
                      return;
                    }

                    if (e.key === "ArrowUp" || e.code === "ArrowUp") {
                      e.preventDefault();
                      setActiveSuggestionIndex((currentIndex) =>
                        (
                          currentIndex +
                          selectableSuggestionItems.length -
                          1
                        ) % selectableSuggestionItems.length
                      );
                      return;
                    }

                    if (e.key === "Escape" || e.code === "Escape") {
                      e.preventDefault();
                      closeSuggestions();
                      return;
                    }
                  }
                  if (shouldHandleSuggestionEnterKeydown(e, suggestionOpen)) {
                    const activeItem =
                      selectableSuggestionItems[activeSuggestionIndex];

                    if (activeItem) {
                      selectSuggestionValue(activeItem.value);
                    }
                    e.preventDefault();
                    return false;
                  }
                }}
                onSubmit={handleSubmit}
              />
    </Flex>
  )
}
