import { Router, type Request, type Response } from "express";

import { sendSuccess } from "../../response";
import { getHealthStatus } from "../../service/health-service";

export function createHealthRouter(): Router {
  const router = Router();

  router.get("/health", (_request: Request, response: Response) => {
    sendSuccess(response, getHealthStatus());
  });

  return router;
}
