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
  getGroupsByQuery: (trigger?: SuggestionTrigger) => WebPlugin.SuggestionGroup[];
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

    return suggestionGroups.map((group) => ({
      ...(group.title ? { title: group.title } : {}),
      suggestions: [...group.suggestions],
      trigger: group.trigger
    }));
  }, [suggestionGroups]);

  const closeSuggestions = useCallback(() => {
    setSuggestionOpen(false);
    currentTrigger.current = null;
  }, []);

  const openSuggestionForTrigger = useCallback((trigger: SuggestionTrigger) => {
    currentTrigger.current = trigger;
    setSuggestionOpen(true);
  }, []);

  const getGroupsByQuery = useCallback((
    trigger?: SuggestionTrigger
  ): WebPlugin.SuggestionGroup[] => {
    if (!trigger || !mergedSuggestionGroups.length) return [];

    return mergedSuggestionGroups.flatMap((group, groupIndex) => {
      if (group.trigger !== trigger.trigger) return [];

      const suggestions = filterSuggestionItems(group.suggestions, trigger.query);
      if (!suggestions.length) return [];

      return [
        {
          ...(group.title ? { title: group.title } : {}),
          suggestions,
          trigger: group.trigger
        }
      ];
    });
  }, [mergedSuggestionGroups]);

  const getItemsByQuery = useCallback((
    trigger?: SuggestionTrigger
  ): WebPlugin.SuggestionItem[] => {
    return getGroupsByQuery(trigger).flatMap((group) => group.suggestions);
  }, [getGroupsByQuery]);

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
    getGroupsByQuery,
    getItemsByQuery,
    getTriggerQuery,
    openSuggestionForTrigger,
    setSuggestionOpen,
    suggestionOpen
  };
}

function filterSuggestionItems(
  items: WebPlugin.SuggestionItem[],
  query: string
): WebPlugin.SuggestionItem[] {
  return items.flatMap((item) => {
    const filteredChildren = item.children
      ? filterSuggestionItems(item.children, query)
      : [];

    if (item.label.includes(query) || item.value.includes(query)) {
      return [item];
    }

    if (filteredChildren.length) {
      return [
        {
          ...item,
          children: filteredChildren
        }
      ];
    }

    return [];
  });
}
