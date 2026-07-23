import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createMcpConfigStorage } from "./storage";
import { McpServerConfigService } from "./service";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

describe("mcp server config service", () => {
  it("encrypts env values and returns plaintext only for runtime configs", () => {
    const service = createService();

    service.saveServerConfig("local", {
      args: ["server.js"],
      command: "node",
      enabled: true,
      env: { TOKEN: "secret-token" },
      headers: {},
      name: "Local MCP",
      transport: "stdio"
    });

    const persisted = service.listServerConfigs()[0];
    expect(persisted?.env).toEqual({ TOKEN: "********" });
    expect(JSON.stringify(service.storage.read())).not.toContain("secret-token");
    expect(service.listEnabledServerConfigs()[0]?.env).toEqual({
      TOKEN: "secret-token"
    });
  });

  it("creates a user env file with an encryption key when missing", () => {
    const service = createService();

    service.saveServerConfig("local", {
      command: "node",
      env: { TOKEN: "secret-token" },
      name: "Local",
      transport: "stdio"
    });

    const userEnv = readFileSync(join(service.userEnvDir, ".env"), "utf8");
    expect(userEnv).toContain("PROVIDER_API_KEY_ENCRYPTION_KEY=");
  });

  it("preserves existing encrypted env values when input value is null", () => {
    const service = createService();

    service.saveServerConfig("local", {
      command: "node",
      env: { TOKEN: "first" },
      name: "Local",
      transport: "stdio"
    });
    service.saveServerConfig("local", {
      command: "node",
      env: { TOKEN: null, EXTRA: "second" },
      name: "Renamed",
      transport: "stdio"
    });

    expect(service.listEnabledServerConfigs()[0]?.env).toEqual({
      EXTRA: "second",
      TOKEN: "first"
    });
  });

  it("excludes disabled servers from runtime configs", () => {
    const service = createService();

    service.saveServerConfig("disabled", {
      command: "node",
      enabled: false,
      name: "Disabled",
      transport: "stdio"
    });

    expect(service.listServerConfigs()).toHaveLength(1);
    expect(service.listEnabledServerConfigs()).toEqual([]);
  });

  it("deletes server configs", () => {
    const service = createService();

    service.saveServerConfig("local", {
      command: "node",
      name: "Local",
      transport: "stdio"
    });
    expect(service.deleteServerConfig("local")).toBe(true);

    expect(service.listServerConfigs()).toEqual([]);
    expect(service.deleteServerConfig("local")).toBe(false);
  });

  it("rejects invalid config input", () => {
    const service = createService();

    expect(() =>
      service.saveServerConfig("bad", { name: "", transport: "stdio" })
    ).toThrow("name is required");
    expect(() =>
      service.saveServerConfig("bad", { name: "Bad", transport: "stdio" })
    ).toThrow("command is required");
    expect(() =>
      service.saveServerConfig("bad", { name: "Bad", transport: "http" })
    ).toThrow("url is required");
  });
});

function createService(): McpServerConfigService & {
  readonly storage: ReturnType<typeof createMcpConfigStorage>;
  readonly userEnvDir: string;
} {
  const dir = mkdtempSync(join(tmpdir(), "hold-rein-mcp-service-"));
  tempDirs.push(dir);
  const storage = createMcpConfigStorage({
    configPath: join(dir, "config.json")
  });
  const service = new McpServerConfigService({
    storage,
    userEnvDir: join(dir, "user-env")
  });

  return Object.assign(service, { storage, userEnvDir: join(dir, "user-env") });
}
