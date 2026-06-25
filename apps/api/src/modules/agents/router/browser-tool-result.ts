import type { AgentsService } from "../service";

interface BrowserToolResultBody {
  content?: unknown;
  isError?: unknown;
}

export function parseBrowserToolResultBody(
  body: BrowserToolResultBody,
  agentId: string,
  toolCallId: string
): Parameters<AgentsService["submitBrowserToolResult"]>[0] | null {
  if (body.isError !== undefined && typeof body.isError !== "boolean") {
    return null;
  }
  const content = parseBrowserToolResultContent(body.content);
  if (!content) return null;
  return {
    agentId,
    content,
    ...(body.isError === undefined ? {} : { isError: body.isError }),
    toolCallId
  };
}

function parseBrowserToolResultContent(
  value: unknown
): Parameters<AgentsService["submitBrowserToolResult"]>[0]["content"] | null {
  if (typeof value === "string" && value.length <= 100_000) return value;
  if (!Array.isArray(value) || value.length > 64) return null;

  const items: { text: string; type: "text" }[] = [];

  for (const item of value) {
    if (!isTextContent(item)) return null;
    items.push({ text: item.text, type: "text" });
  }

  return items;
}

function isTextContent(value: unknown): value is { text: string; type: "text" } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { type?: unknown }).type === "text" &&
    typeof (value as { text?: unknown }).text === "string" &&
    (value as { text: string }).text.length <= 100_000
  );
}
