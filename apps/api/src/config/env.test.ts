import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { loadApiEnv } from "./env";

describe("loadApiEnv", () => {
  it("loads .env values and lets .env.local override them", () => {
    const envDir = createTempEnvDir();
    const targetEnv: NodeJS.ProcessEnv = {};

    writeFileSync(join(envDir, ".env"), "PORT=3001\nSQLITE_DB_PATH=./data/base.sqlite\n");
    writeFileSync(
      join(envDir, ".env.local"),
      "PORT=4100\nPROVIDER_API_KEY_ENCRYPTION_KEY=test-key\n"
    );

    loadApiEnv({ envDir, targetEnv });

    expect(targetEnv.PORT).toBe("4100");
    expect(targetEnv.SQLITE_DB_PATH).toBe("./data/base.sqlite");
    expect(targetEnv.PROVIDER_API_KEY_ENCRYPTION_KEY).toBe("test-key");
  });

  it("does not override values that are already present in the process environment", () => {
    const envDir = createTempEnvDir();
    const targetEnv: NodeJS.ProcessEnv = {
      PORT: "9999"
    };

    writeFileSync(join(envDir, ".env"), "PORT=3001\n");
    writeFileSync(join(envDir, ".env.local"), "PORT=4100\n");

    loadApiEnv({ envDir, targetEnv });

    expect(targetEnv.PORT).toBe("9999");
  });
});

function createTempEnvDir(): string {
  const envDir = join(
    tmpdir(),
    `hold-rein-api-env-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );

  mkdirSync(envDir, { recursive: true });

  return trackTempDir(envDir);
}

function trackTempDir(envDir: string): string {
  process.on("exit", () => {
    rmSync(envDir, { force: true, recursive: true });
  });

  return envDir;
}
