import type { WebPlugin } from "@hold-rein/plugin-web";

import { PLUGIN_ID } from "../plugin-id";
import type { PersistedGomokuTaskGame } from "../shared";
import type { GomokuSessionPersistence } from "./session";

const JSON_HEADERS = { "Content-Type": "application/json" };

export interface CreateRemoteGomokuPersistenceOptions {
  readonly request: WebPlugin.RuntimeContext["request"];
}

export function createRemoteGomokuPersistence({
  request
}: CreateRemoteGomokuPersistenceOptions): GomokuSessionPersistence {
  return {
    async loadGame(taskId) {
      const result = await request<PersistedGomokuTaskGame | null>({
        method: "GET",
        path: gamePath(taskId)
      });
      return result.data;
    },
    async saveGame(game) {
      await request({
        body: JSON.stringify(game),
        headers: JSON_HEADERS,
        method: "PUT",
        path: gamePath(game.taskId)
      });
    }
  };
}

function gamePath(taskId: string): string {
  return `/plugin/${PLUGIN_ID}/tasks/${encodeURIComponent(taskId)}/game`;
}
