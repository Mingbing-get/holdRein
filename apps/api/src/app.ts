import { join } from "node:path";

import express, { type Express } from "express";

import { getApiEnv } from "./config/env";
import { errorMiddleware } from "./middleware/error-middleware";
import { notFoundMiddleware } from "./middleware/not-found-middleware";
import { createV1Router, type CreateV1RouterOptions } from "./router/v1";
import { createRuntimePluginRequestHandler } from './plugin'
import { sendError, sendSuccess, RESPONSE_CODE_DEFINITIONS } from './response'

export interface CreateAppOptions extends CreateV1RouterOptions {
  readonly webAssetsDirectory?: string;
}

export async function createApp(options: CreateAppOptions = {}): Promise<Express> {
  const app = express();

  const pluginRouter = await createPluginRouter();

  app.use(express.json());
  app.use("/api/v1", createV1Router(options));
  app.use("/plugin-assets/:pluginDir", createPluginAssetsMiddleware());
  app.use("/plugin", pluginRouter);
  if (options.webAssetsDirectory !== undefined) {
    const webAssetsDirectory = options.webAssetsDirectory;

    app.use(express.static(webAssetsDirectory));
    app.use((_request, response) => {
      response.sendFile(join(webAssetsDirectory, "index.html"));
    });
  }
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}

function createPluginAssetsMiddleware() {
  return (
    request: express.Request<{ pluginDir: string }>,
    response: express.Response,
    next: express.NextFunction
  ) => {
    const staticMiddleware = express.static(
      join(getApiEnv().pluginRoot, request.params.pluginDir, "dist")
    );

    staticMiddleware(request, response, next);
  };
}

async function createPluginRouter() {
  return createRuntimePluginRequestHandler({
    sendError,
    sendSuccess,
    RESPONSE_CODE_DEFINITIONS
  });
}
