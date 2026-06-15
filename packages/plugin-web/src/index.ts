import type { WebPlugin } from "./type";

export type {
  WebPlugin
};

export interface WebPluginRegistry {
  register: (plugin: WebPlugin.Plugin) => void;
  list: () => readonly WebPlugin.Plugin[];
  get: (id: string) => WebPlugin.Plugin | undefined;
  has: (id: string) => boolean;
}

export function createWebPluginRegistry(): WebPluginRegistry {
  const plugins = new Map<string, WebPlugin.Plugin>();

  return {
    register(plugin) {
      if (plugins.has(plugin.id)) {
        throw new Error(`Web plugin "${plugin.id}" is already registered.`);
      }

      plugins.set(plugin.id, plugin);
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
