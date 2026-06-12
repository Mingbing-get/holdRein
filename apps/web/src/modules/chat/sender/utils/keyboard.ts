export interface SpaceKeydownSource {
  code?: string;
  key?: string;
  isComposing?: boolean;
  nativeEvent?: {
    isComposing?: boolean;
  };
}

export function shouldHandleSpaceKeydown(
  event: SpaceKeydownSource
): boolean {
  if (event.code !== "Space") {
    return false;
  }

  return !(event.isComposing || event.nativeEvent?.isComposing);
}

export interface SuggestionEnterKeydownSource extends SpaceKeydownSource {
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

export function shouldHandleSuggestionEnterKeydown(
  event: SuggestionEnterKeydownSource,
  suggestionOpen: boolean
): boolean {
  if (!suggestionOpen) {
    return false;
  }

  if (event.key !== "Enter" && event.code !== "Enter") {
    return false;
  }

  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return false;
  }

  return !(event.isComposing || event.nativeEvent?.isComposing);
}
