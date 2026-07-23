import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { PersistedMcpConfigFile } from "./types";

export interface McpConfigStorage {
  readonly read: () => PersistedMcpConfigFile;
  readonly write: (configFile: PersistedMcpConfigFile) => void;
}

export interface CreateMcpConfigStorageOptions {
  readonly configPath?: string;
}

export function getDefaultMcpConfigPath(): string {
  return join(homedir(), ".hold-rein", "plugin-data", "mcp", "config.json");
}

export function createMcpConfigStorage(
  options: CreateMcpConfigStorageOptions = {}
): McpConfigStorage {
  const configPath = options.configPath ?? getDefaultMcpConfigPath();

  return {
    read() {
      if (!existsSync(configPath)) {
        return { servers: [] };
      }

      try {
        const parsed = JSON.parse(readFileSync(configPath, "utf8")) as unknown;
        return parseConfigFile(parsed);
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new Error(`MCP config file is malformed JSON: ${configPath}`);
        }

        throw error;
      }
    },
    write(configFile) {
      mkdirSync(dirname(configPath), { recursive: true });
      writeFileSync(configPath, `${JSON.stringify(configFile, null, 2)}\n`);
    }
  };
}

function parseConfigFile(value: unknown): PersistedMcpConfigFile {
  if (!isRecord(value) || !Array.isArray(value.servers)) {
    throw new Error("MCP config file must contain a servers array");
  }

  return { servers: value.servers as PersistedMcpConfigFile["servers"] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
