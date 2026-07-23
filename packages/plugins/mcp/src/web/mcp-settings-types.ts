export type McpTransport = "http" | "sse" | "stdio";

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

export interface McpServerConfigRequest {
  readonly args?: readonly string[];
  readonly command?: string;
  readonly enabled?: boolean;
  readonly env?: Readonly<Record<string, string | null>>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly name: string;
  readonly transport: McpTransport;
  readonly url?: string;
}
