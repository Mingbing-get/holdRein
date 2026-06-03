import { Router } from "express";

import { createHealthRouter } from "../../modules/health";

export function createV1Router(): Router {
  const router = Router();

  router.use(createHealthRouter());

  return router;
}
