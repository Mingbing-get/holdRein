import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createMcpConfigStorage,
  getDefaultMcpConfigPath
} from "./storage";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

describe("mcp config storage", () => {
  it("uses the plugin config file under the user home directory by default", () => {
    expect(getDefaultMcpConfigPath()).toBe(
      join(homedir(), ".hold-rein", "plugin-data", "mcp", "config.json")
    );
  });

  it("reads a missing config file as an empty config", () => {
    const storage = createMcpConfigStorage({
      configPath: join(createTempDir(), "missing", "config.json")
    });

    expect(storage.read()).toEqual({ servers: [] });
  });

  it("creates parent directories when writing config", () => {
    const configPath = join(createTempDir(), "nested", "mcp", "config.json");
    const storage = createMcpConfigStorage({ configPath });

    storage.write({
      servers: [
        {
          args: ["--verbose"],
          enabled: true,
          env: {},
          headers: {},
          id: "local",
          name: "Local",
          transport: "stdio",
          command: "node"
        }
      ]
    });

    expect(JSON.parse(readFileSync(configPath, "utf8"))).toEqual({
      servers: [
        {
          args: ["--verbose"],
          enabled: true,
          env: {},
          headers: {},
          id: "local",
          name: "Local",
          transport: "stdio",
          command: "node"
        }
      ]
    });
  });

  it("rejects malformed JSON with a clear error", () => {
    const configPath = join(createTempDir(), "config.json");
    const storage = createMcpConfigStorage({ configPath });
    storage.write({ servers: [] });
    rmSync(configPath);
    writeFileSync(configPath, "{ nope");

    expect(() => storage.read()).toThrow("MCP config file is malformed JSON");
  });
});

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "hold-rein-mcp-storage-"));
  tempDirs.push(dir);
  return dir;
}
