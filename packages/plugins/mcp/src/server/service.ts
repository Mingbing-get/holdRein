import type { McpConfigStorage } from "./storage";
import { createMcpConfigStorage } from "./storage";
import { decryptSecret, encryptSecret, loadProviderApiKeyEncryptionKey } from "./crypto";
import type {
  EncryptedSecret,
  McpServerConfigInput,
  McpServerConfigSummary,
  McpServerRuntimeConfig,
  PersistedMcpServerConfig
} from "./types";

const MASKED_SECRET = "********";

export interface McpServerConfigServiceOptions {
  readonly storage?: McpConfigStorage;
  readonly userEnvDir?: string;
}

export class McpServerConfigService {
  readonly #storage: McpConfigStorage;
  readonly #userEnvDir: string | undefined;

  constructor(options: McpServerConfigServiceOptions = {}) {
    this.#storage = options.storage ?? createMcpConfigStorage();
    this.#userEnvDir = options.userEnvDir;
  }

  saveServerConfig(
    id: string,
    input: McpServerConfigInput
  ): McpServerConfigSummary {
    validateServerConfigInput(input);
    const configFile = this.#storage.read();
    const existing = configFile.servers.find((server) => server.id === id);
    const nextServer = this.#createPersistedServer(id, input, existing);
    const nextServers = [
      ...configFile.servers.filter((server) => server.id !== id),
      nextServer
    ];

    this.#storage.write({ servers: nextServers });
    return summarizeServerConfig(nextServer);
  }

  listServerConfigs(): McpServerConfigSummary[] {
    return this.#storage.read().servers.map(summarizeServerConfig);
  }

  listEnabledServerConfigs(): McpServerRuntimeConfig[] {
    const key = this.#loadEncryptionKey();

    return this.#storage.read().servers.flatMap((server) => {
      if (!server.enabled) {
        return [];
      }

      return [
        {
          ...server,
          enabled: true,
          env: decryptEnv(server.env, key)
        }
      ];
    });
  }

  deleteServerConfig(id: string): boolean {
    const configFile = this.#storage.read();
    const nextServers = configFile.servers.filter((server) => server.id !== id);

    if (nextServers.length === configFile.servers.length) {
      return false;
    }

    this.#storage.write({ servers: nextServers });
    return true;
  }

  #createPersistedServer(
    id: string,
    input: McpServerConfigInput,
    existing: PersistedMcpServerConfig | undefined
  ): PersistedMcpServerConfig {
    const key = this.#loadEncryptionKey();

    return {
      args: input.args ?? [],
      ...(input.command === undefined ? {} : { command: input.command }),
      enabled: input.enabled ?? true,
      env: encryptEnv(input.env ?? {}, existing?.env ?? {}, key),
      headers: input.headers ?? {},
      id,
      name: input.name.trim(),
      transport: input.transport,
      ...(input.url === undefined ? {} : { url: input.url })
    };
  }

  #loadEncryptionKey(): string {
    return loadProviderApiKeyEncryptionKey(
      this.#userEnvDir === undefined ? {} : { userEnvDir: this.#userEnvDir }
    );
  }
}

function validateServerConfigInput(input: McpServerConfigInput): void {
  if (!input.name.trim()) {
    throw new Error("name is required");
  }

  if (input.transport === "stdio" && !input.command?.trim()) {
    throw new Error("command is required for stdio MCP servers");
  }

  if (
    (input.transport === "http" || input.transport === "sse") &&
    !input.url?.trim()
  ) {
    throw new Error("url is required for http or sse MCP servers");
  }
}

function encryptEnv(
  inputEnv: Readonly<Record<string, string | null>>,
  existingEnv: Readonly<Record<string, EncryptedSecret>>,
  key: string
): Record<string, EncryptedSecret> {
  const encrypted: Record<string, EncryptedSecret> = {};

  for (const [name, value] of Object.entries(inputEnv)) {
    if (value === null) {
      const existing = existingEnv[name];
      if (existing) {
        encrypted[name] = existing;
      }
      continue;
    }

    encrypted[name] = encryptSecret(value, key);
  }

  return encrypted;
}

function decryptEnv(
  env: Readonly<Record<string, EncryptedSecret>>,
  key: string
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).map(([name, encryptedSecret]) => [
      name,
      decryptSecret(encryptedSecret, key)
    ])
  );
}

function summarizeServerConfig(
  server: PersistedMcpServerConfig
): McpServerConfigSummary {
  return {
    ...server,
    env: Object.fromEntries(
      Object.keys(server.env).map((name) => [name, MASKED_SECRET])
    )
  };
}
