import express, { type Express, Router } from "express";

import { errorMiddleware } from "./middleware/error-middleware";
import { notFoundMiddleware } from "./middleware/not-found-middleware";
import { createV1Router, type CreateV1RouterOptions } from "./router/v1";
import { pluginRegistry } from './plugin'
import { sendError, sendSuccess, RESPONSE_CODE_DEFINITIONS } from './response'

export interface CreateAppOptions extends CreateV1RouterOptions {}

export async function createApp(options: CreateAppOptions = {}): Promise<Express> {
  const app = express();

  const pluginRouter = await createPluginRouter();

  app.use(express.json());
  app.use("/api/v1", createV1Router(options));
  app.use("/plugin", pluginRouter);
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}

async function createPluginRouter() {
  const pluginRouter = Router();

  await pluginRegistry.registerRoutes(pluginRouter, {
    sendError,
    sendSuccess,
    RESPONSE_CODE_DEFINITIONS
  })

  return pluginRouter
}
