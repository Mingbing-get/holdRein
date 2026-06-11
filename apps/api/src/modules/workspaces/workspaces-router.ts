import {
  Router,
  type NextFunction,
  type Request,
  type Response
} from "express";

import { sendError, sendSuccess } from "../../response";
import { RESPONSE_CODE_DEFINITIONS } from "../../response/response-codes";
import { getDefaultWorkspacesService } from "./default-workspaces-service";
import type { WorkspacesService } from "./workspaces-service";

export interface CreateWorkspacesRouterOptions {
  workspacesService?: WorkspacesService;
}

const DEFAULT_TASK_PAGE_LIMIT = 20;
const MAX_TASK_PAGE_LIMIT = 100;

export function createWorkspacesRouter(
  options: CreateWorkspacesRouterOptions = {}
): Router {
  const router = Router();
  const getService = (): WorkspacesService =>
    options.workspacesService ?? getDefaultWorkspacesService();

  router.get(
    "/workspaces/recent-tasks",
    (_request: Request, response: Response): void => {
      sendSuccess(response, getService().listRecentWorkspaceTasks());
    }
  );

  router.delete(
    "/workspaces/:workspaceId",
    async (
      request: Request<{ workspaceId: string }>,
      response: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const result = await getService().deleteWorkspace(
          request.params.workspaceId
        );

        if (result.status === "not_found") {
          sendError(
            response,
            RESPONSE_CODE_DEFINITIONS.notFound,
            "Unknown workspace"
          );
          return;
        }

        if (result.status === "has_running_tasks") {
          sendError(
            response,
            RESPONSE_CODE_DEFINITIONS.conflict,
            "Workspace has running tasks"
          );
          return;
        }

        sendSuccess(response, { workspaceId: result.workspaceId });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    "/workspaces/:workspaceId/tasks",
    (request: Request<{ workspaceId: string }>, response: Response): void => {
      const afterLastContinuedAt = getStringQuery(
        request.query.afterLastContinuedAt
      );

      if (afterLastContinuedAt === null || !isIsoDateString(afterLastContinuedAt)) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "afterLastContinuedAt must be an ISO date string"
        );
        return;
      }

      const limit = getLimit(request.query.limit);

      if (limit === null) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          `limit must be an integer from 1 to ${MAX_TASK_PAGE_LIMIT}`
        );
        return;
      }

      const result = getService().listWorkspaceTasksAfter({
        afterLastContinuedAt,
        limit,
        workspaceId: request.params.workspaceId
      });

      if (!result) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.notFound,
          "Unknown workspace"
        );
        return;
      }

      sendSuccess(response, result);
    }
  );

  return router;
}

function getStringQuery(value: Request["query"][string]): string | null {
  return typeof value === "string" ? value : null;
}

function getLimit(value: Request["query"][string]): number | null {
  if (value === undefined) {
    return DEFAULT_TASK_PAGE_LIMIT;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }

  const parsedLimit = Number(value);

  return parsedLimit >= 1 && parsedLimit <= MAX_TASK_PAGE_LIMIT
    ? parsedLimit
    : null;
}

function isIsoDateString(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}
