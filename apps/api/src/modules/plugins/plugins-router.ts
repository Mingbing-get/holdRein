import { Router, type Request, type Response } from "express";

import { sendError, sendSuccess } from "../../response";
import { RESPONSE_CODE_DEFINITIONS } from "../../response/response-codes";
import { reloadServerPlugins } from "../../plugin";
import { createPluginsService } from "./plugins-service";
import type {
  PluginInstallRequest,
  PluginInstallSourceType,
  PluginsService
} from "./plugins-types";

export interface CreatePluginsRouterOptions {
  readonly pluginsService?: PluginsService;
  readonly reloadPlugins?: () => Promise<void>;
}

interface InstallPluginBody {
  readonly source?: unknown;
  readonly sourceType?: unknown;
}

interface UpdatePluginBody {
  readonly disabled?: unknown;
}

export function createPluginsRouter(
  options: CreatePluginsRouterOptions = {}
): Router {
  const router = Router();
  const getService = (): PluginsService =>
    options.pluginsService ?? createPluginsService();
  const reloadPlugins = options.reloadPlugins ?? (() => reloadServerPlugins());

  router.get("/", (_request: Request, response: Response): void => {
    void getService()
      .listPlugins()
      .then((plugins) => sendSuccess(response, { plugins }))
      .catch((error) => sendRouteError(response, error, "Failed to list plugins"));
  });

  router.post(
    "/install",
    (
      request: Request<unknown, unknown, InstallPluginBody>,
      response: Response
    ): void => {
      if (typeof request.body.source !== "string") {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "source must be a string"
        );
        return;
      }

      if (!isPluginInstallSourceType(request.body.sourceType)) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "sourceType must be npm, github, or local"
        );
        return;
      }

      const installRequest: PluginInstallRequest = {
        source: request.body.source,
        sourceType: request.body.sourceType
      };

      void getService()
        .installPlugin(installRequest)
        .then(async (plugin) => {
          await reloadPlugins();
          return plugin;
        })
        .then((plugin) => sendSuccess(response, plugin))
        .catch((error) =>
          sendRouteError(response, error, "Failed to install plugin")
        );
    }
  );

  router.patch(
    "/:pluginId",
    (
      request: Request<{ pluginId: string }, unknown, UpdatePluginBody>,
      response: Response
    ): void => {
      if (typeof request.body.disabled !== "boolean") {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "disabled must be a boolean"
        );
        return;
      }

      void getService()
        .setPluginDisabled(request.params.pluginId, request.body.disabled)
        .then(async (plugin) => {
          if (!plugin) {
            sendError(response, RESPONSE_CODE_DEFINITIONS.notFound, "Unknown plugin");
            return;
          }
          await reloadPlugins();
          sendSuccess(response, plugin);
        })
        .catch((error) =>
          sendRouteError(response, error, "Failed to update plugin")
        );
    }
  );

  router.delete(
    "/:pluginId",
    (request: Request<{ pluginId: string }>, response: Response): void => {
      void getService()
        .uninstallPlugin(request.params.pluginId)
        .then(async (deleted) => {
          if (!deleted) {
            sendError(response, RESPONSE_CODE_DEFINITIONS.notFound, "Unknown plugin");
            return;
          }
          await reloadPlugins();
          sendSuccess(response, { id: request.params.pluginId });
        })
        .catch((error) =>
          sendRouteError(response, error, "Failed to uninstall plugin")
        );
    }
  );

  return router;
}

function isPluginInstallSourceType(
  value: unknown
): value is PluginInstallSourceType {
  return value === "github" || value === "local" || value === "npm";
}

function sendRouteError(response: Response, error: unknown, fallback: string): void {
  sendError(
    response,
    RESPONSE_CODE_DEFINITIONS.badRequest,
    error instanceof Error ? error.message : fallback
  );
}
