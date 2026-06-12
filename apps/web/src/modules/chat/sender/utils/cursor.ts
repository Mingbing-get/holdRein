export type CursorSource = {
  selectionStart?: number | null;
} | null | undefined;

export function getCurrentCursorCharacterIndex(
  source: CursorSource
): number | null {
  return source?.selectionStart ?? null;
}

export function clampCursorIndex(
  value: string,
  cursorIndex: number | null
): number {
  if (cursorIndex == null) {
    return value.length;
  }

  return Math.min(Math.max(cursorIndex, 0), value.length);
}
