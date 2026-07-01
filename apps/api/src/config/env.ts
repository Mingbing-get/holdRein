import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

import { AGENT_ROOT_DIR, PLUGIN_DIR } from "./const";

export interface LoadApiEnvOptions {
  envDir?: string;
  targetEnv?: NodeJS.ProcessEnv;
  userEnvDir?: string;
}

export interface ApiEnv {
  readonly pluginRoot: string;
}

const API_ENV_FILE_NAMES = [".env", ".env.local"] as const;

export function loadApiEnv(options: LoadApiEnvOptions = {}): void {
  const envDir = options.envDir ?? getDefaultApiEnvDir();
  const userEnvDir = options.userEnvDir ?? getDefaultUserEnvDir();
  const targetEnv = options.targetEnv ?? process.env;
  const originalKeys = new Set(Object.keys(targetEnv));

  initializeUserEnv(userEnvDir);
  loadEnvDir(envDir, targetEnv, originalKeys);
  loadEnvDir(userEnvDir, targetEnv, originalKeys);
}

export function getApiEnv(targetEnv: NodeJS.ProcessEnv = process.env): ApiEnv {
  return {
    pluginRoot: targetEnv.HOLD_REIN_PLUGIN_ROOT ?? PLUGIN_DIR
  };
}

function getDefaultApiEnvDir(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../..");
}

function getDefaultUserEnvDir(): string {
  return AGENT_ROOT_DIR;
}

function initializeUserEnv(userEnvDir: string): void {
  const userEnvPath = resolve(userEnvDir, ".env");

  if (existsSync(userEnvPath)) {
    return;
  }

  mkdirSync(userEnvDir, { recursive: true });
  writeFileSync(
    userEnvPath,
    `PROVIDER_API_KEY_ENCRYPTION_KEY=${randomBytes(32).toString("base64")}\n`
  );
}

function loadEnvDir(
  envDir: string,
  targetEnv: NodeJS.ProcessEnv,
  originalKeys: ReadonlySet<string>
): void {
  for (const fileName of API_ENV_FILE_NAMES) {
    const filePath = resolve(envDir, fileName);

    if (!existsSync(filePath)) {
      continue;
    }

    const parsedEntries = parseEnv(readFileSync(filePath, "utf8"));

    for (const [key, value] of Object.entries(parsedEntries)) {
      if (originalKeys.has(key)) {
        continue;
      }

      targetEnv[key] = value;
    }
  }
}
