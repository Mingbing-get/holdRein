import type { Router } from 'express'
import type { ServerPlugin } from './type'

export * from "./type";

export interface ServerPluginRegistry {
  register: (plugin: ServerPlugin.Plugin) => void;
  list: () => ServerPlugin.Plugin[];
  get: (id: string) => ServerPlugin.Plugin | undefined;
  has: (id: string) => boolean;
  registerRoutes: (prefixRouter: Router, context: ServerPlugin.RouteContext) => Promise<void>;
  resolveContributions: (
    context: ServerPlugin.RuntimeContext
  ) => Promise<ServerPlugin.Contribution>;
}

async function resolveContribution(
  resolver: ServerPlugin.ContributionResolver,
  context: ServerPlugin.RuntimeContext
): Promise<ServerPlugin.Contribution> {
  if (typeof resolver === "function") {
    return resolver(context);
  }

  return resolver;
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

    async registerRoutes(prefixRouter: Router, context: ServerPlugin.RouteContext) {
      for (const plugin of plugins.values()) {
        if (!plugin.registerRoutes) continue

        const route = await plugin.registerRoutes(context)
        prefixRouter.use(`/${plugin.id}`, route)
      }
    },

    async resolveContributions(context: ServerPlugin.RuntimeContext) {
      const tools: ServerPlugin.PluginTool[] = [];
      const skills: NonNullable<ServerPlugin.Contribution["skills"]>[number][] = [];
      const skillDirs: string[] = [];
      const systemPrompts: string[] = [];
      const subscribes: NonNullable<ServerPlugin.Contribution["subscribe"]>[] = [];

      for (const plugin of plugins.values()) {
        if (!plugin.contributionResolver) {
          continue;
        }

        const contribution = await resolveContribution(
          plugin.contributionResolver,
          context
        );

        tools.push(...(contribution.tools ?? []));
        skills.push(...(contribution.skills ?? []));
        skillDirs.push(...(contribution.skillDirs ?? []));
        systemPrompts.push(...(contribution.systemPrompts ?? []));

        if (contribution.subscribe) {
          subscribes.push(contribution.subscribe);
        }
      }

      const contribution: ServerPlugin.Contribution = {
        tools,
        skills,
        skillDirs,
        systemPrompts
      };

      if (subscribes.length > 0) {
        return {
          ...contribution,
          subscribe(event) {
            for (const subscribe of subscribes) {
              subscribe(event);
            }
          }
        };
      }

      return contribution;
    }
  };
}
