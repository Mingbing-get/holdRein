# MCP SSE Transport Design

## Goal

Allow the MCP plugin to connect to legacy MCP servers that expose a dedicated SSE endpoint, while preserving the existing `stdio` and Streamable HTTP transports.

## Design

Add `sse` as a first-class transport value throughout persisted configuration, request validation, runtime configuration, and web settings types. It shares the URL and header fields used by `http`.

The MCP client factory selects `SSEClientTransport` only for `sse`; it continues to use `StreamableHTTPClientTransport` for `http`. The settings UI adds an SSE selection and renders URL/headers for both remote transports.

## Validation and tests

`stdio` requires a command. Both `http` and `sse` require a URL. Tests cover accepting SSE server configuration, the SSE form selection, and transport construction behavior.
