export const DEFAULT_MAX_OUTPUT_LENGTH = 20_000;

export function truncateText(
  text: string,
  maxLength = DEFAULT_MAX_OUTPUT_LENGTH
): { text: string; truncated: boolean } {
  if (text.length <= maxLength) {
    return { text, truncated: false };
  }

  return {
    text: `${text.slice(0, maxLength)}\n[output truncated]`,
    truncated: true
  };
}
