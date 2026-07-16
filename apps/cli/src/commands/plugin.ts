import {
  initPluginPackage,
  installPluginPackage as installPluginPackageDefault
} from "@hold-rein/plugin-server";
import { homedir } from "node:os";
import { join } from "node:path";

import { createCommand } from "../command-registry";
import { formatError, readOptionValue } from "../options";

export function createPluginCommand() {
  return createCommand("plugin")
    .use("init", async (args, context) => {
      try {
        const result = initPluginPackage(
          context.options.currentWorkingDirectory ?? process.cwd(),
          parsePluginInitOptions(args)
        );
        context.options.write(`Initialized plugin package ${result.packageName}\n`);
        return { exitCode: 0 };
      } catch (error) {
        context.options.write(
          `Failed to initialize plugin package: ${formatError(error)}\n`
        );
        return { exitCode: 1 };
      }
    })
    .use("install", async (args, context) => {
      try {
        const installOptions = parsePluginInstallOptions(args);
        const installPluginPackage =
          context.options.installPluginPackage ?? installPluginPackageDefault;
        const destination = await installPluginPackage({
          currentWorkingDirectory:
            context.options.currentWorkingDirectory ?? process.cwd(),
          pluginRoot:
            installOptions.target ?? join(homedir(), ".hold-rein", "plugins"),
          source: installOptions.source,
          write: context.options.write
        });
        context.options.write(`Installed plugin to ${destination}\n`);
        return { exitCode: 0 };
      } catch (error) {
        context.options.write(`Failed to install plugin: ${formatError(error)}\n`);
        return { exitCode: 1 };
      }
    });
}

function parsePluginInstallOptions(
  args: readonly string[]
): { readonly source: string; readonly target?: string } {
  const source = args[0];

  if (source === undefined || source.startsWith("-")) {
    throw new Error("Missing plugin source");
  }

  const options: { source: string; target?: string } = { source };
  const target = readOptionValue(args, "--target");

  if (target !== undefined) {
    options.target = target;
  }

  return options;
}

function parsePluginInitOptions(
  args: readonly string[]
): { readonly name?: string; readonly path?: string } {
  const options: { name?: string; path?: string } = {};
  const name = readOptionValue(args, "--name");
  const path = readOptionValue(args, "--path");

  if (name !== undefined) {
    options.name = name;
  }

  if (path !== undefined) {
    options.path = path;
  }

  return options;
}
