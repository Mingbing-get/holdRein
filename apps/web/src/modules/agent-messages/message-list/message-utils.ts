import type { WebPlugin } from "@hold-rein/plugin-web";

const AGENT_CONTINUE_PROMPT = "";

export function formatToolValue(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function getText(content: string | { type: string; text?: string }[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");
}

export function isContinueSentinel(message: WebPlugin.AgentMessage): boolean {
  return message.role === "user" && getText(message.content) === AGENT_CONTINUE_PROMPT;
}
