import express, { type Express } from "express";

import { errorMiddleware } from "./middleware/error-middleware";
import { notFoundMiddleware } from "./middleware/not-found-middleware";
import { createV1Router, type CreateV1RouterOptions } from "./router/v1";

export interface CreateAppOptions extends CreateV1RouterOptions {}

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();

  app.use(express.json());
  app.use("/api/v1", createV1Router(options));
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
