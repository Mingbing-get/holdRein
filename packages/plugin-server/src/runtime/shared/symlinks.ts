import { mkdir, rm, symlink } from "node:fs/promises";
import { dirname, join } from "node:path";

import { SERVER_PLUGIN_SHARED_PACKAGES } from "./packages";

export interface LinkServerPluginSharedPackagesOptions {
  readonly hostNodeModules: string;
  readonly packages?: readonly string[];
  readonly pluginRoot: string;
}

export async function linkServerPluginSharedPackages(
  options: LinkServerPluginSharedPackagesOptions
): Promise<void> {
  for (const packageName of options.packages ?? SERVER_PLUGIN_SHARED_PACKAGES) {
    const linkPath = join(
      options.pluginRoot,
      "node_modules",
      ...packageName.split("/")
    );
    const targetPath = join(options.hostNodeModules, ...packageName.split("/"));

    await mkdir(dirname(linkPath), { recursive: true });
    await rm(linkPath, { force: true, recursive: true });
    await symlink(targetPath, linkPath, "junction");
  }
}
