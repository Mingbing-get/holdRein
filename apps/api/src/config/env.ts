import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

import { PLUGIN_DIR } from "./const";

export interface LoadApiEnvOptions {
  envDir?: string;
  targetEnv?: NodeJS.ProcessEnv;
}

export interface ApiEnv {
  readonly pluginRoot: string;
}

const API_ENV_FILE_NAMES = [".env", ".env.local"] as const;

export function loadApiEnv(options: LoadApiEnvOptions = {}): void {
  const envDir = options.envDir ?? getDefaultApiEnvDir();
  const targetEnv = options.targetEnv ?? process.env;
  const originalKeys = new Set(Object.keys(targetEnv));

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

export function getApiEnv(targetEnv: NodeJS.ProcessEnv = process.env): ApiEnv {
  return {
    pluginRoot: targetEnv.HOLD_REIN_PLUGIN_ROOT ?? PLUGIN_DIR
  };
}

function getDefaultApiEnvDir(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../..");
}
