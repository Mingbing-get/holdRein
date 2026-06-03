import { Router, type Request, type Response } from "express";

import { getHealthStatus } from "../../service/health-service";

export function createHealthRouter(): Router {
  const router = Router();

  router.get("/health", (_request: Request, response: Response) => {
    response.json(getHealthStatus());
  });

  return router;
}
