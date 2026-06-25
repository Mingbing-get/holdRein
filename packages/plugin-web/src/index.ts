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

interface BrowserToolRegistration {
  readonly beforeExecute?: WebPlugin.BrowserToolBeforeExecute;
  readonly executor: WebPlugin.BrowserToolExecutor;
}

const registrations = new Map<string, BrowserToolRegistration>();

export function registerBrowserToolExecutor(
  toolName: string,
  executor: WebPlugin.BrowserToolExecutor,
  beforeExecute?: WebPlugin.BrowserToolBeforeExecute
): () => void {
  const registration: BrowserToolRegistration = {
    ...(beforeExecute === undefined ? {} : { beforeExecute }),
    executor
  };
  registrations.set(toolName, registration);
  return () => {
    if (registrations.get(toolName) === registration) {
      registrations.delete(toolName);
    }
  };
}

export async function executeBrowserTool(
  context: WebPlugin.BrowserToolExecutionOptions
): Promise<{ content: string | WebPlugin.TextContent[]; isError: boolean }> {
  const registration = registrations.get(context.toolName);
  if (!registration) {
    return {
      content: `No browser executor registered for ${context.toolName}.`,
      isError: true
    };
  }

  try {
    const beforeExecuteResult = await registration.beforeExecute?.({
      ...context,
      requestApproval: context.requestApproval ?? requestNoApproval
    });
    if (beforeExecuteResult?.block === true) {
      return { content: beforeExecuteResult.reason, isError: true };
    }

    return { content: await registration.executor(context), isError: false };
  } catch (error) {
    return {
      content:
        error instanceof Error ? error.message : "Browser tool execution failed.",
      isError: true
    };
  }
}

async function requestNoApproval(): Promise<undefined> {
  return undefined;
}

export function clearBrowserToolExecutorsForTests(): void {
  registrations.clear();
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
