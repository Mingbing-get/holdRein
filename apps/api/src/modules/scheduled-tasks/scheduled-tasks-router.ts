import {
  Router,
  type NextFunction,
  type Request,
  type Response
} from "express";

import { sendError, sendSuccess } from "../../response";
import { RESPONSE_CODE_DEFINITIONS } from "../../response/response-codes";
import { getDefaultAgentsService } from "../agents";
import type {
  ScheduledAgentTaskInput,
  ScheduledTaskThinkingLevel
} from "./scheduled-tasks-types";
import {
  getDefaultScheduledTasksService,
  type ScheduledTasksService
} from "./scheduled-tasks-service";

export interface CreateScheduledTasksRouterOptions {
  scheduledTasksService?: ScheduledTasksService;
}

interface ScheduledTaskBody {
  allowConcurrentRuns?: unknown;
  cronExpression?: unknown;
  enabled?: unknown;
  modelId?: unknown;
  name?: unknown;
  prompt?: unknown;
  provider?: unknown;
  thinkingLevel?: unknown;
  timezone?: unknown;
  workspacePath?: unknown;
}

interface ScheduledTasksQuery {
  workspace?: unknown;
  workspacePath?: unknown;
}

export function createScheduledTasksRouter(
  options: CreateScheduledTasksRouterOptions = {}
): Router {
  const router = Router();
  const getService = (): ScheduledTasksService =>
    options.scheduledTasksService ??
    getDefaultScheduledTasksService({
      agentsService: getDefaultAgentsService()
    });

  router.get(
    "/scheduled-tasks",
    (
      request: Request<
        Record<string, never>,
        unknown,
        unknown,
        ScheduledTasksQuery
      >,
      response: Response
    ) => {
      const filter = parseListQuery(request.query);
      if (filter === null) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "workspace must be a string"
        );
        return;
      }

      sendSuccess(
        response,
        filter === undefined
          ? getService().listScheduledTasks()
          : getService().listScheduledTasks(filter)
      );
    }
  );

  router.post(
    "/scheduled-tasks",
    (
      request: Request<Record<string, never>, unknown, ScheduledTaskBody>,
      response: Response,
      next: NextFunction
    ) => {
      const input = parseCreateBody(request.body);
      if (!input) {
        sendError(response, RESPONSE_CODE_DEFINITIONS.badRequest, "Invalid scheduled task");
        return;
      }

      try {
        sendSuccess(response, getService().createScheduledTask(input));
      } catch (error) {
        sendBadRequestOrNext(error, response, next);
      }
    }
  );

  router.get(
    "/scheduled-tasks/:id",
    (request: Request<{ id: string }>, response: Response) => {
      const task = getService().findScheduledTask(request.params.id);
      if (!task) {
        sendNotFound(response);
        return;
      }
      sendSuccess(response, task);
    }
  );

  router.patch(
    "/scheduled-tasks/:id",
    (
      request: Request<{ id: string }, unknown, ScheduledTaskBody>,
      response: Response,
      next: NextFunction
    ) => {
      const input = parseUpdateBody(request.body);
      if (!input) {
        sendError(response, RESPONSE_CODE_DEFINITIONS.badRequest, "Invalid scheduled task");
        return;
      }

      try {
        const task = getService().updateScheduledTask(request.params.id, input);
        if (!task) {
          sendNotFound(response);
          return;
        }
        sendSuccess(response, task);
      } catch (error) {
        sendBadRequestOrNext(error, response, next);
      }
    }
  );

  router.delete(
    "/scheduled-tasks/:id",
    (request: Request<{ id: string }>, response: Response) => {
      if (!getService().deleteScheduledTask(request.params.id)) {
        sendNotFound(response);
        return;
      }
      sendSuccess(response, { id: request.params.id });
    }
  );

  router.post(
    "/scheduled-tasks/:id/enable",
    (request: Request<{ id: string }>, response: Response) => {
      const task = getService().enableScheduledTask(request.params.id);
      if (!task) {
        sendNotFound(response);
        return;
      }
      sendSuccess(response, task);
    }
  );

  router.post(
    "/scheduled-tasks/:id/disable",
    (request: Request<{ id: string }>, response: Response) => {
      const task = getService().disableScheduledTask(request.params.id);
      if (!task) {
        sendNotFound(response);
        return;
      }
      sendSuccess(response, task);
    }
  );

  return router;
}

function parseCreateBody(body: ScheduledTaskBody): ScheduledAgentTaskInput | null {
  const update = parseUpdateBody(body);
  if (
    !update ||
    update.allowConcurrentRuns === undefined ||
    update.cronExpression === undefined ||
    update.modelId === undefined ||
    update.name === undefined ||
    update.prompt === undefined ||
    update.provider === undefined ||
    update.thinkingLevel === undefined ||
    update.timezone === undefined ||
    update.workspacePath === undefined
  ) {
    return null;
  }

  return {
    allowConcurrentRuns: update.allowConcurrentRuns,
    cronExpression: update.cronExpression,
    ...(update.enabled === undefined ? {} : { enabled: update.enabled }),
    modelId: update.modelId,
    name: update.name,
    prompt: update.prompt,
    provider: update.provider,
    thinkingLevel: update.thinkingLevel,
    timezone: update.timezone,
    workspacePath: update.workspacePath
  };
}

function parseListQuery(
  query: ScheduledTasksQuery
): { workspacePath: string } | undefined | null {
  const workspace = query.workspace ?? query.workspacePath;
  if (workspace === undefined) return undefined;
  if (typeof workspace !== "string") return null;
  return { workspacePath: workspace };
}

function parseUpdateBody(
  body: ScheduledTaskBody
): Partial<ScheduledAgentTaskInput> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (!isOptionalBoolean(body.allowConcurrentRuns)) return null;
  if (!isOptionalBoolean(body.enabled)) return null;
  if (!isOptionalString(body.cronExpression)) return null;
  if (!isOptionalString(body.modelId)) return null;
  if (!isOptionalString(body.name)) return null;
  if (!isOptionalString(body.prompt)) return null;
  if (!isOptionalString(body.provider)) return null;
  if (!isOptionalString(body.timezone)) return null;
  if (!isOptionalString(body.workspacePath)) return null;
  if (
    body.thinkingLevel !== undefined &&
    typeof body.thinkingLevel !== "string"
  ) {
    return null;
  }

  return {
    ...(body.allowConcurrentRuns === undefined
      ? {}
      : { allowConcurrentRuns: body.allowConcurrentRuns }),
    ...(body.cronExpression === undefined
      ? {}
      : { cronExpression: body.cronExpression }),
    ...(body.enabled === undefined ? {} : { enabled: body.enabled }),
    ...(body.modelId === undefined ? {} : { modelId: body.modelId }),
    ...(body.name === undefined ? {} : { name: body.name }),
    ...(body.prompt === undefined ? {} : { prompt: body.prompt }),
    ...(body.provider === undefined ? {} : { provider: body.provider }),
    ...(body.thinkingLevel === undefined
      ? {}
      : { thinkingLevel: body.thinkingLevel as ScheduledTaskThinkingLevel }),
    ...(body.timezone === undefined ? {} : { timezone: body.timezone }),
    ...(body.workspacePath === undefined
      ? {}
      : { workspacePath: body.workspacePath })
  };
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === "boolean";
}

function sendBadRequestOrNext(
  error: unknown,
  response: Response,
  next: NextFunction
): void {
  if (error instanceof Error) {
    sendError(response, RESPONSE_CODE_DEFINITIONS.badRequest, error.message);
    return;
  }

  next(error);
}

function sendNotFound(response: Response): void {
  sendError(response, RESPONSE_CODE_DEFINITIONS.notFound, "Unknown scheduled task");
}
