import type { WebPlugin } from "@hold-rein/plugin-web";

export interface BrowserToolExecutionContext {
  agentId: string;
  arguments: Record<string, unknown>;
  taskId: string;
  toolCallId: string;
  toolName: string;
}

export type BrowserToolExecutor = (
  context: BrowserToolExecutionContext
) =>
  | Promise<string | WebPlugin.TextContent[]>
  | string
  | WebPlugin.TextContent[];

const executors = new Map<string, BrowserToolExecutor>();

export function registerBrowserToolExecutor(
  toolName: string,
  executor: BrowserToolExecutor
): () => void {
  executors.set(toolName, executor);
  return () => {
    if (executors.get(toolName) === executor) {
      executors.delete(toolName);
    }
  };
}

export async function executeBrowserTool(
  context: BrowserToolExecutionContext
): Promise<{ content: string | WebPlugin.TextContent[]; isError: boolean }> {
  const executor = executors.get(context.toolName);
  if (!executor) {
    return {
      content: `No browser executor registered for ${context.toolName}.`,
      isError: true
    };
  }

  try {
    return { content: await executor(context), isError: false };
  } catch (error) {
    return {
      content:
        error instanceof Error ? error.message : "Browser tool execution failed.",
      isError: true
    };
  }
}

export function clearBrowserToolExecutorsForTests(): void {
  executors.clear();
}
