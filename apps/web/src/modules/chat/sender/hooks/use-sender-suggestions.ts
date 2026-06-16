import { useCallback, useMemo, useRef, useState } from "react";
import type { WebPlugin } from "@hold-rein/plugin-web";

export interface SuggestionTrigger {
  trigger: WebPlugin.SuggestionGroup["trigger"];
  query: string;
}

export interface UseSenderSuggestionsOptions {
  suggestionGroups?: WebPlugin.SuggestionGroup[] | undefined;
}

export interface UseSenderSuggestionsResult {
  currentTrigger: React.RefObject<SuggestionTrigger | null>;
  suggestionOpen: boolean;
  closeSuggestions: () => void;
  getItemsByQuery: (trigger?: SuggestionTrigger) => WebPlugin.SuggestionItem[];
  getTriggerQuery: (
    value: string,
    cursorIndex?: number | null
  ) => SuggestionTrigger | undefined;
  openSuggestionForTrigger: (trigger: SuggestionTrigger) => void;
  setSuggestionOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useSenderSuggestions({
  suggestionGroups
}: UseSenderSuggestionsOptions): UseSenderSuggestionsResult {
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const currentTrigger = useRef<SuggestionTrigger>(null);
  const mergedSuggestionGroups = useMemo(() => {
    if (!suggestionGroups?.length) return [];

    const groupsByTrigger = new Map<string, WebPlugin.SuggestionGroup>();

    for (const group of suggestionGroups) {
      const existingGroup = groupsByTrigger.get(group.trigger);

      if (existingGroup) {
        existingGroup.suggestions.push(...group.suggestions);
        continue;
      }

      groupsByTrigger.set(group.trigger, {
        suggestions: [...group.suggestions],
        trigger: group.trigger
      });
    }

    return Array.from(groupsByTrigger.values());
  }, [suggestionGroups]);

  const closeSuggestions = useCallback(() => {
    setSuggestionOpen(false);
    currentTrigger.current = null;
  }, []);

  const openSuggestionForTrigger = useCallback((trigger: SuggestionTrigger) => {
    currentTrigger.current = trigger;
    setSuggestionOpen(true);
  }, []);

  const getItemsByQuery = useCallback((
    trigger?: SuggestionTrigger
  ): WebPlugin.SuggestionItem[] => {
    if (!trigger || !mergedSuggestionGroups.length) return [];

    for (const group of mergedSuggestionGroups) {
      if (group.trigger === trigger.trigger) {
        return group.suggestions.filter((item) =>
          item.label.includes(trigger.query)
        );
      }
    }

    return [];
  }, [suggestionGroups]);

  const getTriggerQuery = useCallback((
    value: string,
    cursorIndex?: number | null
  ): SuggestionTrigger | undefined => {
    if (!value || !mergedSuggestionGroups.length) return;

    const textBeforeCursor =
      cursorIndex == null ? value : value.slice(0, cursorIndex);

    if (textBeforeCursor.length === 1) {
      for (const group of mergedSuggestionGroups) {
        if (group.trigger === textBeforeCursor) {
          return {
            query: "",
            trigger: group.trigger
          };
        }
      }
      return;
    }

    const splitValues = textBeforeCursor.split(" ");
    const matchValue = splitValues[splitValues.length - 1];
    if (!matchValue) return;

    for (const group of mergedSuggestionGroups) {
      if (matchValue.startsWith(`${group.trigger}`)) {
        const trigger: SuggestionTrigger = {
          query: matchValue.substring(1),
          trigger: group.trigger
        };

        const items = getItemsByQuery(trigger);
        if (!items.length) return;

        return trigger;
      }
    }
  }, [getItemsByQuery, mergedSuggestionGroups]);

  return {
    closeSuggestions,
    currentTrigger,
    getItemsByQuery,
    getTriggerQuery,
    openSuggestionForTrigger,
    setSuggestionOpen,
    suggestionOpen
  };
}
