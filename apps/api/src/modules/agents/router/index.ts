import { Router, type Request, type Response } from "express";

import { sendError, sendSuccess } from "../../../response";
import { RESPONSE_CODE_DEFINITIONS } from "../../../response/response-codes";
import { getDefaultSkillsService, type SkillsService } from "../../skills";
import type { AgentEventEnvelope } from "../agent-types";
import { listWorkspaceSkills } from "../runtime/support";
import { getDefaultAgentsService } from "../service/default";
import type { AgentsService } from "../service";
import {
  getRequiredQueryString,
  parseAfterSequence,
  parseContinueTaskBody,
  parseStartAgentBody,
  type ContinueTaskBody,
  type StartAgentBody
} from "./request-parsing";
import { parseBrowserToolResultBody } from "./browser-tool-result";

interface ApprovalDecisionBody {
  approved?: boolean;
  reason?: unknown;
}

interface RenameTaskBody {
  title?: string;
}

export interface CreateAgentsRouterOptions {
  agentsService?: AgentsService;
  skillDirs?: string[];
  skillsService?: SkillsService;
}

export function createAgentsRouter(
  options: CreateAgentsRouterOptions = {}
): Router {
  const router = Router();
  const getService = (): AgentsService =>
    options.agentsService ?? getDefaultAgentsService();
  const getSkillsService = (): SkillsService =>
    options.skillsService ?? getDefaultSkillsService();

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
          "workspacePath, provider, modelId and prompt must be strings; runtimeContributions must be valid when provided"
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
    "/agents/skills",
    (request: Request, response: Response): void => {
      const workspacePath = getRequiredQueryString(request.query.workspacePath);

      if (workspacePath === null) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "workspacePath must be a string"
        );
        return;
      }

      void listWorkspaceSkills(
        workspacePath,
        options.skillDirs,
        getSkillsService()
      )
        .then((skills) => {
          sendSuccess(response, { skills });
        })
        .catch((error) => {
          sendError(
            response,
            RESPONSE_CODE_DEFINITIONS.badRequest,
            error instanceof Error ? error.message : "Failed to list skills"
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
          "prompt must be a string, provider and modelId must both be strings when provided, and runtimeContributions must be valid when provided"
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

  router.post(
    "/agents/:agentId/browser-tools/:toolCallId/result",
    (
      request: Request<
        { agentId: string; toolCallId: string },
        unknown,
        { content?: unknown; isError?: unknown }
      >,
      response: Response
    ): void => {
      const input = parseBrowserToolResultBody(
        request.body,
        request.params.agentId,
        request.params.toolCallId
      );

      if (!input) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "content must be a string or text content array"
        );
        return;
      }

      void getService()
        .submitBrowserToolResult(input)
        .then((result) => {
          if (!result) {
            sendError(
              response,
              RESPONSE_CODE_DEFINITIONS.notFound,
              "Unknown browser tool call"
            );
            return;
          }
          sendSuccess(response, result);
        })
        .catch((error) => {
          sendError(
            response,
            RESPONSE_CODE_DEFINITIONS.badRequest,
            error instanceof Error
              ? error.message
              : "Failed to submit browser tool result"
          );
        });
    }
  );

  return router;
}

function writeNdjsonEvent(response: Response, event: AgentEventEnvelope): void {
  response.write(`${JSON.stringify(event)}\n`);
}
