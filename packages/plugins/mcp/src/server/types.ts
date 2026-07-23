export type McpTransport = "http" | "sse" | "stdio";

export interface EncryptedSecret {
  readonly ciphertext: string;
  readonly iv: string;
  readonly tag: string;
}

export interface PersistedMcpServerConfig {
  readonly args: readonly string[];
  readonly command?: string;
  readonly enabled: boolean;
  readonly env: Readonly<Record<string, EncryptedSecret>>;
  readonly headers: Readonly<Record<string, string>>;
  readonly id: string;
  readonly name: string;
  readonly transport: McpTransport;
  readonly url?: string;
}

export interface PersistedMcpConfigFile {
  readonly servers: readonly PersistedMcpServerConfig[];
}

export type McpSecretInputValue = string | null;

export interface McpServerConfigInput {
  readonly args?: readonly string[];
  readonly command?: string;
  readonly enabled?: boolean;
  readonly env?: Readonly<Record<string, McpSecretInputValue>>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly name: string;
  readonly transport: McpTransport;
  readonly url?: string;
}

export interface McpServerConfigSummary {
  readonly args: readonly string[];
  readonly command?: string;
  readonly enabled: boolean;
  readonly env: Readonly<Record<string, string>>;
  readonly headers: Readonly<Record<string, string>>;
  readonly id: string;
  readonly name: string;
  readonly transport: McpTransport;
  readonly url?: string;
}

export interface McpServerRuntimeConfig {
  readonly args: readonly string[];
  readonly command?: string;
  readonly enabled: true;
  readonly env: Readonly<Record<string, string>>;
  readonly headers: Readonly<Record<string, string>>;
  readonly id: string;
  readonly name: string;
  readonly transport: McpTransport;
  readonly url?: string;
}
