import type { ServerPlugin } from './type'

export * from "./type";

export interface ServerPluginRegistry {
  register: (plugin: ServerPlugin.Plugin) => void;
  list: () => ServerPlugin.Plugin[];
  get: (id: string) => ServerPlugin.Plugin | undefined;
  has: (id: string) => boolean;
  registerRoutes: (context: ServerPlugin.RouteContext) => Promise<void>;
  resolveContributions: (context: ServerPlugin.RuntimeContext) => Promise<void>;
}

export function createServerPluginRegistry(): ServerPluginRegistry {
  const plugins = new Map<string, ServerPlugin.Plugin>();

  return {
    register(plugin) {
      if (plugins.has(plugin.id)) {
        throw new Error(`Server plugin "${plugin.id}" is already registered.`);
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
    },

    async registerRoutes(context: ServerPlugin.RouteContext) {
      
    },

    async resolveContributions(context: ServerPlugin.RuntimeContext) {}
  };
}
