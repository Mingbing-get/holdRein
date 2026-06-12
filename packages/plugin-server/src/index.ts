export interface ServerPluginContext {
  readonly agentCore?: unknown;
  readonly ai?: unknown;
}

export interface ServerPlugin {
  readonly id: string;
  readonly name?: string;
  setup?: (context: ServerPluginContext) => void | Promise<void>;
}

export interface ServerPluginRegistry {
  register: (plugin: ServerPlugin) => void;
  list: () => readonly ServerPlugin[];
  get: (id: string) => ServerPlugin | undefined;
  has: (id: string) => boolean;
}

export function createServerPluginRegistry(): ServerPluginRegistry {
  const plugins = new Map<string, ServerPlugin>();

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
    }
  };
}
