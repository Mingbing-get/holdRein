import { useCallback, useState, useRef } from "react";
import { Flex } from "antd";
import { Sender as ASender, Suggestion, type SenderProps } from "@ant-design/x";

export interface SuggestionItem {
  label: string;
  value: string;
  icon?: React.ReactNode;
  children?: SuggestionItem[];
  extra?: React.ReactNode;
}

export interface SuggestionGroup {
  trigger: `${string}` & { length: 1 };
  suggestions: SuggestionItem[]
}

interface SuggestionTrigger {
  trigger: SuggestionGroup['trigger']
  query: string
}

interface Props extends Pick<SenderProps, 'autoSize' | 'className' | 'classNames' | 'disabled' | 'loading' | 'onSubmit' | 'placeholder'> {
  suggestionGroups?: SuggestionGroup[]
  onMessageChange?: (message: string) => void
}

export default function Sender({ suggestionGroups, onMessageChange, ...senderProps }: Props) {
  const [draftMessage, setDraftMessage] = useState("");
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const currentTrigger = useRef<SuggestionTrigger>(null)

  const handleChangeMessage = useCallback((v: string) => {
    setDraftMessage(v)
    onMessageChange?.(v)
  }, [onMessageChange])

  const handleAppendSpace = useCallback((e: React.KeyboardEvent) => {
    handleChangeMessage(`${draftMessage} `)
  }, [draftMessage, handleChangeMessage])

  const getItemsByQuery = useCallback((trigger?: SuggestionTrigger): SuggestionItem[] => {
    if (!trigger || !suggestionGroups?.length) return []

    for (const group of suggestionGroups) {
      if (group.trigger === trigger.trigger) {
        return group.suggestions.filter(item => item.label.includes(trigger.query))
      }
    }

    return []
  }, [suggestionGroups])

  const getTriggerQuery = useCallback((value: string): SuggestionTrigger | undefined => {
    if (!value || !suggestionGroups?.length) return

    if (value.length === 1) {
      for (const group of suggestionGroups) {
        if (group.trigger === value) {
          return {
            trigger: group.trigger,
            query: ''
          }
        }
      }
      return
    }

    const splitValues = value.split(' ')
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

  return <Flex vertical>
    <Suggestion<SuggestionTrigger>
      getPopupContainer={(triggerNode) =>
        triggerNode.parentElement ?? document.body
      }
      items={(info) => getItemsByQuery(info)}
      onOpenChange={setSuggestionOpen}
      onSelect={(value) => {
        handleChangeMessage(value);
        setSuggestionOpen(false);
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
              classNames={{
                input: "chat-workspace-sender-input"
              }}
              onChange={(nextValue, e) => {
                console.log(e)
                handleChangeMessage(nextValue);

                const trigger = getTriggerQuery(nextValue)

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
              value={draftMessage}
              onKeyDown={e => {
                if (e.code === 'Space') {
                  handleAppendSpace(e)
                }
                onKeyDown(e)
              }}
            />
          );
        })()
      )}
    </Suggestion>
  </Flex>
}