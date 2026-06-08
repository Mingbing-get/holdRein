import { Router } from "express";

import {
  createAgentsRouter,
  type CreateAgentsRouterOptions
} from "../../modules/agents";
import {
  createFileSystemRouter,
  type CreateFileSystemRouterOptions
} from "../../modules/file-system";
import { createHealthRouter } from "../../modules/health";
import {
  createModelProvidersRouter,
  type CreateModelProvidersRouterOptions
} from "../../modules/model-providers/model-providers-router";
import {
  createWorkspacesRouter,
  type CreateWorkspacesRouterOptions
} from "../../modules/workspaces";

export interface CreateV1RouterOptions
  extends CreateAgentsRouterOptions,
    CreateFileSystemRouterOptions,
    CreateModelProvidersRouterOptions,
    CreateWorkspacesRouterOptions {}

export function createV1Router(options: CreateV1RouterOptions = {}): Router {
  const router = Router();

  router.use(createAgentsRouter(options));
  router.use(createHealthRouter());
  router.use(createFileSystemRouter(options));
  router.use(createWorkspacesRouter(options));
  router.use(createModelProvidersRouter(options));

  return router;
}
