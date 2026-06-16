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
