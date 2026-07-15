import type { WebPlugin } from "@hold-rein/plugin-web";

import { PLUGIN_ID } from "../plugin-id";
import type { PersistedXiangqiTaskGame } from "../shared";
import type { XiangqiSessionPersistence } from "./session";

const JSON_HEADERS = { "Content-Type": "application/json" };

export interface CreateRemoteXiangqiPersistenceOptions {
  readonly request: WebPlugin.RuntimeContext["request"];
}

export function createRemoteXiangqiPersistence({
  request
}: CreateRemoteXiangqiPersistenceOptions): XiangqiSessionPersistence {
  return {
    async loadGame(taskId) {
      const result = await request<PersistedXiangqiTaskGame | null>({
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
