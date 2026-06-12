export interface SpaceKeydownSource {
  code?: string;
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
