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
  createModelProxiesRouter,
  type CreateModelProxiesRouterOptions
} from "../../modules/model-proxies";
import { createPluginsRouter } from "../../modules/plugins/plugins-router";
import {
  createSkillsRouter,
  type CreateSkillsRouterOptions
} from "../../modules/skills";
import {
  createWorkspacesRouter,
  type CreateWorkspacesRouterOptions
} from "../../modules/workspaces";
import {
  createUsageStatsRouter,
  type CreateUsageStatsRouterOptions
} from "../../modules/usage-stats";
import { getRuntimeWebPlugins } from "../../plugin";

export interface CreateV1RouterOptions
  extends CreateAgentsRouterOptions,
    CreateFileSystemRouterOptions,
    CreateModelProvidersRouterOptions,
    CreateModelProxiesRouterOptions,
    CreateSkillsRouterOptions,
    CreateUsageStatsRouterOptions,
    CreateWorkspacesRouterOptions {}

export function createV1Router(options: CreateV1RouterOptions = {}): Router {
  const router = Router();

  router.use(createAgentsRouter(options));
  router.use(createHealthRouter());
  router.use(createFileSystemRouter(options));
  router.use(createWorkspacesRouter(options));
  router.use(createModelProxiesRouter(options));
  router.use(createModelProvidersRouter(options));
  router.use(
    "/plugins",
    createPluginsRouter({
      plugins: getRuntimeWebPlugins()
    })
  );
  router.use(createSkillsRouter(options));
  router.use(createUsageStatsRouter(options));

  return router;
}
