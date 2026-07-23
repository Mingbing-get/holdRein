---
name: mcp-configuration
description: Use when a user asks to add, modify, diagnose, or locate an MCP server configuration in HoldRein.
---

# MCP Configuration

Use this skill to configure MCP servers for HoldRein. Before changing a
configuration, inspect the existing file and preserve other servers.

## Supported transports

Only these transports are supported:

- `stdio`: starts a local process. Requires `command`; supports optional string
  `args` and `env`.
- `http`: connects to a Streamable HTTP endpoint. Requires `url`; supports
  optional string `headers`.
- `sse`: connects to a legacy SSE endpoint. Requires `url`; supports optional
  string `headers`.

Do not configure unsupported transports or fields.

## Configuration location

The persisted MCP configuration is:

```text
~/.hold-rein/plugin-data/mcp/config.json
```

It contains a top-level `servers` array. Each server has an `id`, `name`,
`transport`, `enabled`, `args`, `headers`, and either `command` (`stdio`) or
`url` (`http` and `sse`).

## Safe configuration

Do not use an API to manage MCP servers. Read and modify
`~/.hold-rein/plugin-data/mcp/config.json` directly. Preserve existing server
entries and do not write plain-text environment secrets: persisted `env` values
use the plugin's encrypted `{ ciphertext, iv, tag }` format.

When a configuration change is complete, ensure the server is enabled. Restart
or start a new agent run so its MCP tools are discovered.
