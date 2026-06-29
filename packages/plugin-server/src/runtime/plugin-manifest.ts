import { access, readdir } from "node:fs/promises";
import { join } from "node:path";

import type { PackageEntryManifest } from "../type";

function requirePackageString(
  input: Record<string, unknown>,
  key: string
): string {
  const value = input[key];
  if (typeof value !== "string") {
    throw new Error(`Plugin package "${key}" must be a string.`);
  }

  return value;
}

export function parseServerPluginManifest(
  input: unknown
): PackageEntryManifest {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Plugin package manifest must be an object.");
  }

  const packageManifest = input as Record<string, unknown>;
  const packageName = requirePackageString(packageManifest, "name");
  const version = requirePackageString(packageManifest, "version");
  const serverEntry = resolvePackageExport(
    packageManifest.exports,
    "./server"
  ) ?? resolvePackageExport(packageManifest.exports, ".");
  const webEntry = resolvePackageExport(packageManifest.exports, "./web");
  const webStyle = resolvePackageStyleExport(packageManifest.exports, "./web");

  if (!serverEntry) {
    throw new Error('Plugin package "exports" must define a server entry.');
  }

  return {
    id: packageName,
    name: packageName,
    packageName,
    serverEntry,
    version,
    ...(webEntry === undefined ? {} : { webEntry }),
    ...(webStyle === undefined ? {} : { webStyle })
  };
}

export async function discoverServerPluginManifests(
  pluginRoot: string
): Promise<string[]> {
  const entries = await readdir(pluginRoot, { withFileTypes: true }).catch(
    () => []
  );
  const manifests: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "node_modules") {
      continue;
    }

    manifests.push(join(pluginRoot, entry.name, "package.json"));
  }

  return existingFiles(manifests);
}

async function existingFiles(paths: readonly string[]): Promise<string[]> {
  const existing: string[] = [];

  for (const path of paths) {
    try {
      await access(path);
      existing.push(path);
    } catch {
      // Missing package manifests are ignored during discovery.
    }
  }

  return existing;
}

function resolvePackageExport(
  exportsField: unknown,
  subpath: "." | "./server" | "./web"
): string | undefined {
  if (typeof exportsField === "string") {
    return subpath === "." ? exportsField : undefined;
  }
  if (
    !exportsField ||
    typeof exportsField !== "object" ||
    Array.isArray(exportsField)
  ) {
    return undefined;
  }

  const exportMap = exportsField as Record<string, unknown>;
  const exportValue =
    subpath === "." && !Object.keys(exportMap).some((key) => key.startsWith("."))
      ? exportMap
      : exportMap[subpath];

  return resolveExportValue(exportValue);
}

function resolvePackageStyleExport(
  exportsField: unknown,
  subpath: "./web"
): string | undefined {
  if (
    !exportsField ||
    typeof exportsField !== "object" ||
    Array.isArray(exportsField)
  ) {
    return undefined;
  }

  const exportMap = exportsField as Record<string, unknown>;
  const exportValue = exportMap[subpath];

  if (
    !exportValue ||
    typeof exportValue !== "object" ||
    Array.isArray(exportValue)
  ) {
    return undefined;
  }

  const conditions = exportValue as Record<string, unknown>;
  const style = conditions.style;

  return typeof style === "string" ? style : undefined;
}

function resolveExportValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const conditions = value as Record<string, unknown>;
  const preferredConditions = ["import", "default", "module"] as const;

  for (const condition of preferredConditions) {
    const resolved = resolveExportValue(conditions[condition]);
    if (resolved) {
      return resolved;
    }
  }

  return undefined;
}
