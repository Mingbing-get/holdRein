import type { WebPlugin } from "@hold-rein/plugin-web";

import { PLUGIN_ID } from "../plugin-id";
import type {
  McpServerConfigRequest,
  McpServerConfigSummary
} from "./mcp-settings-types";

const SERVERS_PATH = `/plugin/${PLUGIN_ID}/servers`;

export function listMcpServers(
  request: WebPlugin.RuntimeContext["request"]
): Promise<WebPlugin.Result<McpServerConfigSummary[]>> {
  return request({ method: "GET", path: SERVERS_PATH });
}

export function saveMcpServer(
  request: WebPlugin.RuntimeContext["request"],
  id: string,
  input: McpServerConfigRequest
): Promise<WebPlugin.Result<McpServerConfigSummary>> {
  return request({
    body: JSON.stringify(input),
    headers: { "Content-Type": "application/json" },
    method: "PUT",
    path: `${SERVERS_PATH}/${encodeURIComponent(id)}`
  });
}

export function deleteMcpServer(
  request: WebPlugin.RuntimeContext["request"],
  id: string
): Promise<WebPlugin.Result<{ deleted: boolean }>> {
  return request({
    method: "DELETE",
    path: `${SERVERS_PATH}/${encodeURIComponent(id)}`
  });
}
