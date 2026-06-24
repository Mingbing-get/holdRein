import { Router, type Request, type Response } from "express";

import { sendError, sendSuccess } from "../../response";
import { RESPONSE_CODE_DEFINITIONS } from "../../response/response-codes";
import { getDefaultSkillsService } from "./default-skills-service";
import type { SkillsService } from "./skills-types";

export interface CreateSkillsRouterOptions {
  skillsService?: SkillsService;
}

interface InstallSkillBody {
  repositoryUrl?: unknown;
}

interface UpdateSkillBody {
  disabled?: unknown;
}

export function createSkillsRouter(
  options: CreateSkillsRouterOptions = {}
): Router {
  const router = Router();
  const getService = (): SkillsService =>
    options.skillsService ?? getDefaultSkillsService();

  router.get("/skills", (_request: Request, response: Response): void => {
    void getService()
      .listSkills()
      .then((skills) => sendSuccess(response, { skills }))
      .catch((error) => sendRouteError(response, error, "Failed to list skills"));
  });

  router.post(
    "/skills/install",
    (request: Request<unknown, unknown, InstallSkillBody>, response: Response): void => {
      if (typeof request.body.repositoryUrl !== "string") {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "repositoryUrl must be a string"
        );
        return;
      }

      void getService()
        .installSkill(request.body.repositoryUrl)
        .then((skill) => sendSuccess(response, skill))
        .catch((error) => sendRouteError(response, error, "Failed to install skill"));
    }
  );

  router.patch(
    "/skills/:skillId",
    (
      request: Request<{ skillId: string }, unknown, UpdateSkillBody>,
      response: Response
    ): void => {
      if (typeof request.body.disabled !== "boolean") {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "disabled must be a boolean"
        );
        return;
      }

      void getService()
        .setSkillDisabled(request.params.skillId, request.body.disabled)
        .then((skill) => {
          if (!skill) {
            sendError(response, RESPONSE_CODE_DEFINITIONS.notFound, "Unknown skill");
            return;
          }
          sendSuccess(response, skill);
        })
        .catch((error) => sendRouteError(response, error, "Failed to update skill"));
    }
  );

  router.delete(
    "/skills/:skillId",
    (request: Request<{ skillId: string }>, response: Response): void => {
      void getService()
        .uninstallSkill(request.params.skillId)
        .then((deleted) => {
          if (!deleted) {
            sendError(response, RESPONSE_CODE_DEFINITIONS.notFound, "Unknown skill");
            return;
          }
          sendSuccess(response, { id: request.params.skillId });
        })
        .catch((error) => sendRouteError(response, error, "Failed to uninstall skill"));
    }
  );

  return router;
}

function sendRouteError(response: Response, error: unknown, fallback: string): void {
  sendError(
    response,
    RESPONSE_CODE_DEFINITIONS.badRequest,
    error instanceof Error ? error.message : fallback
  );
}
