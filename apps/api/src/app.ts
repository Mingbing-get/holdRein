import express, { type Express } from "express";

import { errorMiddleware } from "./middleware/error-middleware";
import { notFoundMiddleware } from "./middleware/not-found-middleware";
import { createV1Router } from "./router/v1";

export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use("/api/v1", createV1Router());
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
