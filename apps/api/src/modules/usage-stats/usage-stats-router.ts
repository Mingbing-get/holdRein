import { Router, type Request, type Response } from "express";

import { sendError, sendSuccess } from "../../response";
import { RESPONSE_CODE_DEFINITIONS } from "../../response/response-codes";
import { getDefaultUsageStatsService } from "./default-usage-stats-service";
import type {
  ModelUsageRange,
  TaskUsageGroupBy,
  TaskUsageRange
} from "./usage-stats-types";
import type { UsageStatsService } from "./usage-stats-service";

export interface CreateUsageStatsRouterOptions {
  usageStatsService?: UsageStatsService;
}

export function createUsageStatsRouter(
  options: CreateUsageStatsRouterOptions = {}
): Router {
  const router = Router();
  const getService = (): UsageStatsService =>
    options.usageStatsService ?? getDefaultUsageStatsService();

  router.get("/usage-stats/models", (request: Request, response: Response) => {
    const range = getStringQuery(request.query.range) ?? "24h";

    if (!isModelUsageRange(range)) {
      sendError(
        response,
        RESPONSE_CODE_DEFINITIONS.badRequest,
        "range must be 24h or 30d"
      );
      return;
    }

    sendSuccess(response, getService().getModelTokenUsage({ range }));
  });

  router.get("/usage-stats/tasks", (request: Request, response: Response) => {
    const range = getStringQuery(request.query.range) ?? "7d";
    const groupBy = getStringQuery(request.query.groupBy) ?? "task";

    if (!isTaskUsageRange(range)) {
      sendError(
        response,
        RESPONSE_CODE_DEFINITIONS.badRequest,
        "range must be 7d or 30d"
      );
      return;
    }

    if (!isTaskUsageGroupBy(groupBy)) {
      sendError(
        response,
        RESPONSE_CODE_DEFINITIONS.badRequest,
        "groupBy must be task or workspace"
      );
      return;
    }

    sendSuccess(response, getService().getTaskTokenUsage({ groupBy, range }));
  });

  return router;
}

function getStringQuery(value: Request["query"][string]): string | null {
  return typeof value === "string" ? value : null;
}

function isModelUsageRange(value: string): value is ModelUsageRange {
  return value === "24h" || value === "30d";
}

function isTaskUsageRange(value: string): value is TaskUsageRange {
  return value === "7d" || value === "30d";
}

function isTaskUsageGroupBy(value: string): value is TaskUsageGroupBy {
  return value === "task" || value === "workspace";
}
