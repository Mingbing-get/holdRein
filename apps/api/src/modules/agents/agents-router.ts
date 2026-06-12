import { Router, type Request, type Response } from "express";

import { sendError, sendSuccess } from "../../response";
import { RESPONSE_CODE_DEFINITIONS } from "../../response/response-codes";
import type { AgentEventEnvelope, StartAgentInput } from "./agent-types";
import { getDefaultAgentsService } from "./default-agents-service";
import type { AgentsService } from "./agents-service";

export interface CreateAgentsRouterOptions {
  agentsService?: AgentsService;
}

interface StartAgentBody {
  modelId?: string;
  prompt?: string;
  provider?: string;
  workspacePath?: string;
}

interface ApprovalDecisionBody {
  approved?: boolean;
  reason?: unknown;
}

interface ContinueTaskBody {
  modelId?: string;
  prompt?: string;
  provider?: string;
}

interface RenameTaskBody {
  title?: string;
}

export function createAgentsRouter(
  options: CreateAgentsRouterOptions = {}
): Router {
  const router = Router();
  const getService = (): AgentsService =>
    options.agentsService ?? getDefaultAgentsService();

  router.post(
    "/agents/start",
    (
      request: Request<unknown, unknown, StartAgentBody>,
      response: Response
    ): void => {
      const input = parseStartAgentBody(request.body);

      if (!input) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "workspacePath, provider, modelId and prompt must be strings"
        );
        return;
      }

      void getService()
        .startAgent(input)
        .then((result) => {
          sendSuccess(response, result);
        })
        .catch((error) => {
          sendError(
            response,
            RESPONSE_CODE_DEFINITIONS.badRequest,
            error instanceof Error ? error.message : "Failed to start agent"
          );
        });
    }
  );

  router.get(
    "/agents/tasks/:taskId/messages",
    (request: Request<{ taskId: string }>, response: Response): void => {
      void getService()
        .listTaskMessages({ taskId: request.params.taskId })
        .then((messages) => sendSuccess(response, messages))
        .catch((error) => {
          sendError(
            response,
            RESPONSE_CODE_DEFINITIONS.badRequest,
            error instanceof Error ? error.message : "Failed to load task messages"
          );
        });
    }
  );

  router.patch(
    "/agents/tasks/:taskId",
    (
      request: Request<{ taskId: string }, unknown, RenameTaskBody>,
      response: Response
    ): void => {
      const title =
        typeof request.body.title === "string" ? request.body.title.trim() : "";

      if (!title) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "title must be a non-empty string"
        );
        return;
      }

      void getService()
        .renameTask({ taskId: request.params.taskId, title })
        .then((result) => {
          if (!result) {
            sendError(response, RESPONSE_CODE_DEFINITIONS.notFound, "Unknown task");
            return;
          }
          sendSuccess(response, result);
        })
        .catch((error) => {
          sendError(
            response,
            RESPONSE_CODE_DEFINITIONS.badRequest,
            error instanceof Error ? error.message : "Failed to rename task"
          );
        });
    }
  );

  router.delete(
    "/agents/tasks/:taskId",
    (request: Request<{ taskId: string }>, response: Response): void => {
      void getService()
        .deleteTask({ taskId: request.params.taskId })
        .then((result) => {
          if (result.status === "not_found") {
            sendError(response, RESPONSE_CODE_DEFINITIONS.notFound, "Unknown task");
            return;
          }
          if (result.status === "running") {
            sendError(response, RESPONSE_CODE_DEFINITIONS.conflict, "Task is running");
            return;
          }
          sendSuccess(response, { taskId: result.taskId });
        })
        .catch((error) => {
          sendError(
            response,
            RESPONSE_CODE_DEFINITIONS.badRequest,
            error instanceof Error ? error.message : "Failed to delete task"
          );
        });
    }
  );

  router.post(
    "/agents/tasks/:taskId/continue",
    (
      request: Request<{ taskId: string }, unknown, ContinueTaskBody>,
      response: Response
    ): void => {
      const input = parseContinueTaskBody(request.body, request.params.taskId);

      if (!input) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "prompt must be a string and provider and modelId must both be strings when provided"
        );
        return;
      }

      void getService()
        .continueTask(input)
        .then((result) => {
          if (!result) {
            sendError(response, RESPONSE_CODE_DEFINITIONS.notFound, "Unknown task");
            return;
          }
          sendSuccess(response, result);
        })
        .catch((error) => {
          sendError(
            response,
            RESPONSE_CODE_DEFINITIONS.badRequest,
            error instanceof Error ? error.message : "Failed to continue task"
          );
        });
    }
  );

  router.post(
    "/agents/tasks/:taskId/interrupt",
    (request: Request<{ taskId: string }>, response: Response): void => {
      void getService()
        .interruptTask({ taskId: request.params.taskId })
        .then((result) => {
          if (result.status === "not_found") {
            sendError(response, RESPONSE_CODE_DEFINITIONS.notFound, "Unknown task");
            return;
          }
          if (result.status === "not_running") {
            sendError(
              response,
              RESPONSE_CODE_DEFINITIONS.conflict,
              "Task is not running"
            );
            return;
          }
          sendSuccess(response, result);
        })
        .catch((error) => {
          sendError(
            response,
            RESPONSE_CODE_DEFINITIONS.badRequest,
            error instanceof Error ? error.message : "Failed to interrupt task"
          );
        });
    }
  );

  router.get(
    "/agents/tasks/:taskId/title",
    (request: Request<{ taskId: string }>, response: Response): void => {
      void getService()
        .getTaskTitle({ taskId: request.params.taskId })
        .then((result) => {
          if (!result) {
            sendError(
              response,
              RESPONSE_CODE_DEFINITIONS.notFound,
              "Unknown task"
            );
            return;
          }

          sendSuccess(response, result);
        })
        .catch((error) => {
          sendError(
            response,
            RESPONSE_CODE_DEFINITIONS.badRequest,
            error instanceof Error ? error.message : "Failed to get task title"
          );
        });
    }
  );

  router.get(
    "/agents/:agentId/events",
    (request: Request<{ agentId: string }>, response: Response): void => {
      const afterSequence = parseAfterSequence(request.query.afterSequence);

      if (afterSequence === null) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "afterSequence must be a non-negative integer"
        );
        return;
      }

      response.status(200);
      response.setHeader("Content-Type", "application/x-ndjson");
      response.setHeader("Cache-Control", "no-cache");
      response.setHeader("Connection", "keep-alive");
      response.flushHeaders();

      const subscription = getService().subscribeToAgentEvents(
        {
          ...(afterSequence === undefined ? {} : { afterSequence }),
          agentId: request.params.agentId
        },
        (event) => {
          writeNdjsonEvent(response, event);
        }
      );

      request.on("close", () => {
        subscription.unsubscribe();
      });
    }
  );

  router.post(
    "/agents/:agentId/approvals/:approvalId",
    (
      request: Request<
        { agentId: string; approvalId: string },
        unknown,
        ApprovalDecisionBody
      >,
      response: Response
    ): void => {
      if (typeof request.body.approved !== "boolean") {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "approved must be a boolean"
        );
        return;
      }
      if (
        request.body.reason !== undefined &&
        typeof request.body.reason !== "string"
      ) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "reason must be a string"
        );
        return;
      }

      void getService()
        .approveAgentAction({
          agentId: request.params.agentId,
          approvalId: request.params.approvalId,
          approved: request.body.approved,
          ...(request.body.reason === undefined
            ? {}
            : { reason: request.body.reason })
        })
        .then((result) => {
          sendSuccess(response, result);
        })
        .catch((error) => {
          sendError(
            response,
            RESPONSE_CODE_DEFINITIONS.notFound,
            error instanceof Error ? error.message : "Unknown approval request"
          );
        });
    }
  );

  return router;
}

function parseContinueTaskBody(
  body: ContinueTaskBody,
  taskId: string
): Parameters<AgentsService["continueTask"]>[0] | null {
  if (typeof body.prompt !== "string") {
    return null;
  }

  if (body.provider === undefined && body.modelId === undefined) {
    return { prompt: body.prompt, taskId };
  }

  if (typeof body.provider !== "string" || typeof body.modelId !== "string") {
    return null;
  }

  return {
    modelId: body.modelId,
    prompt: body.prompt,
    provider: body.provider,
    taskId
  };
}

function parseStartAgentBody(body: StartAgentBody): StartAgentInput | null {
  if (
    typeof body.workspacePath !== "string" ||
    typeof body.provider !== "string" ||
    typeof body.modelId !== "string" ||
    typeof body.prompt !== "string"
  ) {
    return null;
  }

  return {
    modelId: body.modelId,
    prompt: body.prompt,
    provider: body.provider,
    workspacePath: body.workspacePath
  };
}

function parseAfterSequence(
  value: Request["query"][string]
): number | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }

  return Number(value);
}

function writeNdjsonEvent(response: Response, event: AgentEventEnvelope): void {
  response.write(`${JSON.stringify(event)}\n`);
}
