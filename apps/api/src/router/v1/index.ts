import { Router } from "express";

import {
  createFileSystemRouter,
  type CreateFileSystemRouterOptions
} from "../../modules/file-system";
import { createHealthRouter } from "../../modules/health";
import {
  createModelProvidersRouter,
  type CreateModelProvidersRouterOptions
} from "../../modules/model-providers/model-providers-router";

export interface CreateV1RouterOptions
  extends CreateFileSystemRouterOptions,
    CreateModelProvidersRouterOptions {}

export function createV1Router(options: CreateV1RouterOptions = {}): Router {
  const router = Router();

  router.use(createHealthRouter());
  router.use(createFileSystemRouter(options));
  router.use(createModelProvidersRouter(options));

  return router;
}
