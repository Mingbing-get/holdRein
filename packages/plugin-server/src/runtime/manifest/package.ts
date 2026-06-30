import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface PluginPackageManifest {
  readonly name: string;
  readonly exports?: unknown;
  readonly packageJson: Record<string, unknown>;
  readonly publishConfig?: unknown;
}

export async function readValidPluginPackageManifest(
  packageDirectory: string
): Promise<PluginPackageManifest> {
  const manifest = JSON.parse(
    await readFile(join(packageDirectory, "package.json"), "utf8")
  ) as unknown;

  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("Plugin package manifest must be an object.");
  }

  const packageManifest = manifest as Record<string, unknown>;
  const name = packageManifest.name;

  if (typeof name !== "string" || name.length === 0) {
    throw new Error('Plugin package "name" must be a string.');
  }

  if (!hasServerExport(packageManifest.exports)) {
    throw new Error('Plugin package "exports" must define "./server".');
  }

  return {
    exports: packageManifest.exports,
    name,
    packageJson: packageManifest,
    publishConfig: packageManifest.publishConfig
  };
}

export function createPublishedManifest(
  manifest: PluginPackageManifest
): Record<string, unknown> {
  if (
    manifest.publishConfig &&
    typeof manifest.publishConfig === "object" &&
    !Array.isArray(manifest.publishConfig)
  ) {
    return {
      ...withoutPublishConfig(manifest.packageJson),
      ...(manifest.publishConfig as Record<string, unknown>),
      name: manifest.name
    };
  }

  return withoutPublishConfig(manifest.packageJson);
}

export function isBuiltPackageManifest(
  manifest: PluginPackageManifest
): boolean {
  const serverEntry = resolveExportValue(
    (manifest.exports as Record<string, unknown>)["./server"]
  );

  return Boolean(serverEntry && !isSourceEntry(serverEntry));
}

function hasServerExport(exportsField: unknown): boolean {
  if (!exportsField || typeof exportsField !== "object" || Array.isArray(exportsField)) {
    return false;
  }

  return Object.hasOwn(exportsField, "./server");
}

function withoutPublishConfig(
  packageJson: Record<string, unknown>
): Record<string, unknown> {
  const publishedManifest = { ...packageJson };
  delete publishedManifest.publishConfig;

  return publishedManifest;
}

function isSourceEntry(entry: string): boolean {
  return (
    entry.startsWith("./src/") ||
    entry.includes("/src/") ||
    entry.endsWith(".ts") ||
    entry.endsWith(".tsx")
  );
}

function resolveExportValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const conditions = value as Record<string, unknown>;

  return (
    resolveExportValue(conditions.import) ??
    resolveExportValue(conditions.default) ??
    resolveExportValue(conditions.module)
  );
}
