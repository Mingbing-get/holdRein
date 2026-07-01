import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { PLUGIN_DIR } from "./const";
import { getApiEnv, loadApiEnv } from "./env";

describe("loadApiEnv", () => {
  it("loads .env values and lets .env.local override them", () => {
    const envDir = createTempEnvDir();
    const userEnvDir = createTempEnvDir();
    const targetEnv: NodeJS.ProcessEnv = {};

    writeFileSync(
      join(envDir, ".env"),
      "PORT=3001\nSQLITE_DB_PATH=./data/base.sqlite\n"
    );
    writeFileSync(
      join(envDir, ".env.local"),
      "PORT=4100\nHOLD_REIN_PLUGIN_ROOT=/tmp/local-plugins\n"
    );

    loadApiEnv({ envDir, targetEnv, userEnvDir });

    expect(targetEnv.PORT).toBe("4100");
    expect(targetEnv.SQLITE_DB_PATH).toBe("./data/base.sqlite");
    expect(targetEnv.HOLD_REIN_PLUGIN_ROOT).toBe("/tmp/local-plugins");
  });

  it("does not override values that are already present in the process environment", () => {
    const envDir = createTempEnvDir();
    const userEnvDir = createTempEnvDir();
    const targetEnv: NodeJS.ProcessEnv = {
      PORT: "9999"
    };

    writeFileSync(join(envDir, ".env"), "PORT=3001\n");
    writeFileSync(join(envDir, ".env.local"), "PORT=4100\n");

    loadApiEnv({ envDir, targetEnv, userEnvDir });

    expect(targetEnv.PORT).toBe("9999");
  });

  it("creates a user .env with an encryption key when it does not exist", () => {
    const runtimeEnvDir = createTempEnvDir();
    const userEnvDir = createTempEnvDir();
    const targetEnv: NodeJS.ProcessEnv = {};

    loadApiEnv({ envDir: runtimeEnvDir, targetEnv, userEnvDir });

    const userEnvPath = join(userEnvDir, ".env");
    expect(existsSync(userEnvPath)).toBe(true);

    const generatedKey = targetEnv.PROVIDER_API_KEY_ENCRYPTION_KEY;
    expect(generatedKey).toBeDefined();
    expect(Buffer.from(generatedKey ?? "", "base64")).toHaveLength(32);
    expect(readFileSync(userEnvPath, "utf8")).toContain(
      `PROVIDER_API_KEY_ENCRYPTION_KEY=${generatedKey}`
    );
  });

  it("loads user .env values before runtime .env values", () => {
    const runtimeEnvDir = createTempEnvDir();
    const userEnvDir = createTempEnvDir();
    const targetEnv: NodeJS.ProcessEnv = {
      PORT: "9999"
    };

    writeFileSync(
      join(userEnvDir, ".env"),
      "PORT=3001\nPROVIDER_API_KEY_ENCRYPTION_KEY=user-key\n"
    );
    writeFileSync(
      join(runtimeEnvDir, ".env"),
      "PORT=4100\nPROVIDER_API_KEY_ENCRYPTION_KEY=runtime-key\n"
    );

    loadApiEnv({ envDir: runtimeEnvDir, targetEnv, userEnvDir });

    expect(targetEnv.PORT).toBe("9999");
    expect(targetEnv.PROVIDER_API_KEY_ENCRYPTION_KEY).toBe("user-key");
  });
});

describe("getApiEnv", () => {
  it("defaults plugin storage to the central home directory", () => {
    expect(getApiEnv({}).pluginRoot).toBe(PLUGIN_DIR);
  });

  it("allows HOLD_REIN_PLUGIN_ROOT to override plugin storage", () => {
    expect(
      getApiEnv({ HOLD_REIN_PLUGIN_ROOT: "/tmp/custom-plugins" }).pluginRoot
    ).toBe("/tmp/custom-plugins");
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
