import { Router } from "express";

import { sendSuccess } from "../../response";
import type { RuntimePluginManifest } from "@hold-rein/plugin-server";

export interface CreatePluginsRouterOptions {
  readonly plugins: readonly RuntimePluginManifest[];
}

export function createPluginsRouter(options: CreatePluginsRouterOptions): Router {
  const router = Router();

  router.get("/", (_request, response) => {
    sendSuccess(response, {
      plugins: options.plugins
    });
  });

  return router;
}
