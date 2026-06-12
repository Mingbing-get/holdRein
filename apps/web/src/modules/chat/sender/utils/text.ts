import { clampCursorIndex } from "./cursor";

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
