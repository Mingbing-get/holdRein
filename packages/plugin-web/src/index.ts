import type { WebPlugin } from "./type";

export type {
  WebPlugin
};

export type WebPluginListener = (plugin: WebPlugin.Plugin) => void;

export interface WebPluginRegistry {
  register: (plugin: WebPlugin.Plugin) => void;
  on: (listener: WebPluginListener) => (() => void)
  list: () => readonly WebPlugin.Plugin[];
  get: (id: string) => WebPlugin.Plugin | undefined;
  has: (id: string) => boolean;
}

const executors = new Map<string, WebPlugin.BrowserToolExecutor>();

export function registerBrowserToolExecutor(
  toolName: string,
  executor: WebPlugin.BrowserToolExecutor
): () => void {
  executors.set(toolName, executor);
  return () => {
    if (executors.get(toolName) === executor) {
      executors.delete(toolName);
    }
  };
}

export async function executeBrowserTool(
  context: WebPlugin.BrowserToolExecutionContext
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

export function createWebPluginRegistry(): WebPluginRegistry {
  const plugins = new Map<string, WebPlugin.Plugin>();
  const listeners = new Array<WebPluginListener>;

  const triggerListener = (plugin: WebPlugin.Plugin) => {
    listeners.forEach(listener => {
      try {
        listener(plugin)
      } catch {
        return;
      }
    })
  }

  return {
    register(plugin) {
      if (plugins.has(plugin.id)) {
        throw new Error(`Web plugin "${plugin.id}" is already registered.`);
      }

      plugins.set(plugin.id, plugin);
      triggerListener(plugin)
    },
    on(listener: WebPluginListener) {
      listeners.push(listener)

      return () => {
        const index = listeners.findIndex(item => item === listener)
        if (index === -1) return

        listeners.splice(index, 1)
      }
    },
    list() {
      return [...plugins.values()];
    },
    get(id) {
      return plugins.get(id);
    },
    has(id) {
      return plugins.has(id);
    }
  };
}
