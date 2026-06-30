import type { Router } from 'express'
import type { ServerPlugin } from './type'

export * from "./type";
export { loadInstalledServerPlugins } from "./runtime/loader";
export type {
  LoadedServerPlugins,
  LoadInstalledServerPluginsOptions
} from "./runtime/loader";
export {
  copyInstalledPluginPackage,
  encodePluginDirectoryName,
  installPluginPackage,
  installNpmPluginPackage
} from "./runtime/installer";
export type {
  CopyInstalledPluginPackageOptions,
  InstallPluginPackageOptions,
  InstallNpmPluginPackageOptions
} from "./runtime/installer";
export type {
  PluginInstallCommandResult,
  PluginInstallCommandRunner,
  PluginInstallWriter
} from "./runtime/installer/command";
export {
  discoverServerPluginManifests,
  parseServerPluginManifest
} from "./runtime/manifest";
export { SERVER_PLUGIN_SHARED_PACKAGES } from "./runtime/shared/packages";
export { linkServerPluginSharedPackages } from "./runtime/shared/symlinks";
export type { LinkServerPluginSharedPackagesOptions } from "./runtime/shared/symlinks";

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
      const agentEndHandlers: NonNullable<ServerPlugin.Contribution["onAgentEnd"]>[] = [];

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
        if (contribution.onAgentEnd) {
          agentEndHandlers.push(contribution.onAgentEnd);
        }
      }

      const contribution: ServerPlugin.Contribution = {
        tools,
        skills,
        skillDirs,
        systemPrompts
      };

      return {
        ...contribution,
        ...(subscribes.length > 0
          ? {
              subscribe(event: Parameters<NonNullable<ServerPlugin.Contribution["subscribe"]>>[0]) {
                for (const subscribe of subscribes) {
                  subscribe(event);
                }
              }
            }
          : {}),
        ...(agentEndHandlers.length > 0
          ? {
              async onAgentEnd(input: ServerPlugin.AgentEndInput) {
                for (const onAgentEnd of agentEndHandlers) {
                  const continuation = await onAgentEnd(input);
                  if (continuation) {
                    return continuation;
                  }
                }

                return undefined;
              }
            }
          : {})
      };
    }
  };
}
