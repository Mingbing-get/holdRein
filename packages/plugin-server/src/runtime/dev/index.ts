import { spawn as spawnChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import { watch as watchFiles } from "node:fs";
import { resolve } from "node:path";

import type { RuntimePluginManifest } from "../../type";

export interface DevServerPluginEntry {
  readonly entryPath: string;
  readonly manifest: RuntimePluginManifest;
  readonly packageDirectory: string;
}

export interface DevPluginManager {
  readonly close: () => Promise<void>;
  readonly getServerPluginEntries: () => readonly DevServerPluginEntry[];
  readonly getWebPluginManifests: () => readonly RuntimePluginManifest[];
}

export interface StartDevPluginManagerOptions {
  readonly debounceMs?: number;
  readonly onReload?: () => void | Promise<void>;
  readonly pluginPaths: readonly string[];
  readonly spawn?: DevProcessSpawner;
  readonly watch?: DevFileWatcher;
}

export type DevProcessSpawner = (
  command: string,
  args: readonly string[],
  options: { readonly cwd: string }
) => DevChildProcess;

export interface DevChildProcess {
  readonly kill: () => void;
  readonly stdout?: {
    readonly on: (event: "data", listener: (chunk: unknown) => void) => void;
  };
}

export type DevFileWatcher = (
  path: string,
  callback: () => void
) => { readonly close: () => void };

interface PackageJson {
  readonly exports?: unknown;
  readonly name: string;
  readonly scripts?: Readonly<Record<string, string>>;
  readonly version: string;
}

interface DevPluginState {
  readonly child: DevChildProcess;
  readonly manifest: MutableRuntimePluginManifest;
  readonly packageDirectory: string;
  readonly serverEntryPath: string;
  readonly webEntryPath: string;
  readonly watcher?: { readonly close: () => void };
  devServerOrigin?: string;
}

interface MutableRuntimePluginManifest {
  dev: true;
  disabled?: boolean;
  id: string;
  name: string;
  packageName: string;
  version: string;
  webEntry: string;
  webEntryType: "module";
  webStyle?: string;
}

const DEFAULT_DEBOUNCE_MS = 100;

export async function startDevPluginManager(
  options: StartDevPluginManagerOptions
): Promise<DevPluginManager> {
  const spawn = options.spawn ?? defaultSpawn;
  const watch = options.watch ?? defaultWatch;
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  let reloadTimer: ReturnType<typeof setTimeout> | undefined;
  const states: DevPluginState[] = [];

  const scheduleReload = (): void => {
    if (!options.onReload) {
      return;
    }
    if (reloadTimer !== undefined) {
      clearTimeout(reloadTimer);
    }
    reloadTimer = setTimeout(() => {
      reloadTimer = undefined;
      void options.onReload?.();
    }, debounceMs);
  };

  for (const pluginPath of options.pluginPaths) {
    const packageDirectory = resolve(pluginPath);
    const packageJson = await readPluginPackageJson(packageDirectory);

    if (!packageJson.scripts?.dev) {
      throw new Error(
        `Development plugin "${packageJson.name}" must define a dev script.`
      );
    }

    const serverEntryPath = resolve(
      packageDirectory,
      resolvePackageExport(packageJson.exports, "./server")
    );
    const webEntryPath = resolvePackageExport(packageJson.exports, "./web");
    const manifest: MutableRuntimePluginManifest = {
      dev: true,
      id: packageJson.name,
      name: packageJson.name,
      packageName: packageJson.name,
      version: packageJson.version,
      webEntry: "",
      webEntryType: "module"
    };
    const child = spawn("pnpm", ["dev"], { cwd: packageDirectory });
    const state: DevPluginState = {
      child,
      manifest,
      packageDirectory,
      serverEntryPath,
      webEntryPath
    };
    const watcher = watch(packageDirectory, scheduleReload);

    states.push({ ...state, watcher });
    child.stdout?.on("data", (chunk) => {
      const origin = parseViteOrigin(String(chunk));
      if (origin !== undefined) {
        state.devServerOrigin = origin;
        manifest.webEntry = new URL(stripRelativePrefix(webEntryPath), origin)
          .href;
      }
    });
  }

  return {
    async close() {
      if (reloadTimer !== undefined) {
        clearTimeout(reloadTimer);
      }
      for (const state of states) {
        state.watcher?.close();
        state.child.kill();
      }
    },
    getServerPluginEntries() {
      return states.map((state) => ({
        entryPath: state.serverEntryPath,
        manifest: state.manifest,
        packageDirectory: state.packageDirectory
      }));
    },
    getWebPluginManifests() {
      return states
        .filter((state) => state.manifest.webEntry.length > 0)
        .map((state) => state.manifest);
    }
  };
}

async function readPluginPackageJson(
  packageDirectory: string
): Promise<PackageJson> {
  const input = JSON.parse(
    await readFile(resolve(packageDirectory, "package.json"), "utf8")
  ) as Partial<PackageJson>;

  if (typeof input.name !== "string") {
    throw new Error('Development plugin package "name" must be a string.');
  }
  if (typeof input.version !== "string") {
    throw new Error('Development plugin package "version" must be a string.');
  }

  return {
    name: input.name,
    ...(input.exports === undefined ? {} : { exports: input.exports }),
    ...(input.scripts === undefined ? {} : { scripts: input.scripts }),
    version: input.version
  };
}

function resolvePackageExport(exportsField: unknown, subpath: string): string {
  const value = resolvePackageExportValue(
    typeof exportsField === "object" && exportsField !== null
      ? (exportsField as Record<string, unknown>)[subpath]
      : undefined
  );

  if (value === undefined) {
    throw new Error(`Development plugin exports must define "${subpath}".`);
  }

  return value;
}

function resolvePackageExportValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const conditions = value as Record<string, unknown>;
  return (
    resolvePackageExportValue(conditions.import) ??
    resolvePackageExportValue(conditions.default) ??
    resolvePackageExportValue(conditions.module)
  );
}

function parseViteOrigin(output: string): string | undefined {
  const match = output.match(/https?:\/\/(?:localhost|127\.0\.0\.1):\d+\//);

  if (!match) {
    return undefined;
  }

  return match[0];
}

function stripRelativePrefix(path: string): string {
  return path.replace(/^\.\//, "");
}

const defaultSpawn: DevProcessSpawner = (command, args, options) =>
  spawnChildProcess(command, [...args], {
    cwd: options.cwd,
    stdio: ["ignore", "pipe", "inherit"]
  });

const defaultWatch: DevFileWatcher = (path, callback) =>
  watchFiles(path, { recursive: true }, callback);
