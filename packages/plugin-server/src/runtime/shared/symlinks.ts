import { mkdir, rm, symlink } from "node:fs/promises";
import { join } from "node:path";

export interface LinkServerPluginNodeModulesOptions {
  readonly hostNodeModules: string;
  readonly pluginRoot: string;
}

export async function linkServerPluginNodeModules(
  options: LinkServerPluginNodeModulesOptions
): Promise<void> {
  const linkPath = join(options.pluginRoot, "node_modules");

  await mkdir(options.pluginRoot, { recursive: true });
  await rm(linkPath, { force: true, recursive: true });
  await symlink(options.hostNodeModules, linkPath, "junction");
}

export type LinkServerPluginSharedPackagesOptions =
  LinkServerPluginNodeModulesOptions;

export const linkServerPluginSharedPackages = linkServerPluginNodeModules;
