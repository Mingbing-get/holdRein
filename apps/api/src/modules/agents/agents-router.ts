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

      void getService()
        .approveAgentAction({
          agentId: request.params.agentId,
          approvalId: request.params.approvalId,
          approved: request.body.approved
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
