import { isAbsolute } from "node:path";

import { Router, type Response } from "express";
import type { ServerPlugin } from "@hold-rein/plugin-server";

import {
  createGitService,
  GitConflictError,
  GitValidationError,
  type GitService
} from "./git-service";

interface RouterOptions {
  readonly createGitService?: (workspacePath: string) => GitService;
}

export default function createRouter(
  context: ServerPlugin.RouteContext,
  options: RouterOptions = {}
): Router {
  const router = Router();
  const serviceFactory = options.createGitService ?? createGitService;

  router.get("/status", async (request, response) => {
    const workspacePath = readWorkspacePath(request.query.workspacePath);
    if (!workspacePath) {
      sendBadRequest(context, response, "An absolute workspacePath is required");
      return;
    }

    await runOperation(context, response, async () => {
      const status = await serviceFactory(workspacePath).getStatus();
      context.sendSuccess(response, status);
    });
  });

  router.get("/diff", async (request, response) => {
    const workspacePath = readWorkspacePath(request.query.workspacePath);
    const filePath = readNonEmptyString(request.query.filePath);
    if (!workspacePath || !filePath) {
      sendBadRequest(context, response, "workspacePath and filePath are required");
      return;
    }

    await runOperation(context, response, async () => {
      const diff = await serviceFactory(workspacePath).getFileDiff(filePath);
      context.sendSuccess(response, { diff });
    });
  });

  router.post("/initialize", async (request, response) => {
    const workspacePath = readWorkspacePath(request.body?.workspacePath);
    if (!workspacePath) {
      sendBadRequest(context, response, "An absolute workspacePath is required");
      return;
    }

    await runOperation(context, response, async () => {
      await serviceFactory(workspacePath).initialize();
      context.sendSuccess(response, undefined);
    });
  });

  router.post("/branches/switch", async (request, response) => {
    const workspacePath = readWorkspacePath(request.body?.workspacePath);
    const branch = readNonEmptyString(request.body?.branch);
    if (!workspacePath || !branch) {
      sendBadRequest(context, response, "workspacePath and branch are required");
      return;
    }

    await runOperation(context, response, async () => {
      await serviceFactory(workspacePath).switchBranch(branch);
      context.sendSuccess(response, undefined);
    });
  });

  router.post("/commits", async (request, response) => {
    const workspacePath = readWorkspacePath(request.body?.workspacePath);
    const message = readNonEmptyString(request.body?.message);
    const push = request.body?.push;
    if (!workspacePath || !message || typeof push !== "boolean") {
      sendBadRequest(
        context,
        response,
        "workspacePath, message, and boolean push are required"
      );
      return;
    }

    await runOperation(context, response, async () => {
      await serviceFactory(workspacePath).commit(message, push);
      context.sendSuccess(response, undefined);
    });
  });

  return router;
}

async function runOperation(
  context: ServerPlugin.RouteContext,
  response: Response,
  operation: () => Promise<void>
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof GitConflictError) {
      context.sendError(
        response,
        context.RESPONSE_CODE_DEFINITIONS.conflict,
        error.message
      );
      return;
    }

    if (error instanceof GitValidationError) {
      sendBadRequest(context, response, error.message);
      return;
    }

    const message = error instanceof Error ? error.message : "Git operation failed";
    context.sendError(
      response,
      context.RESPONSE_CODE_DEFINITIONS.internalError,
      message
    );
  }
}

function sendBadRequest(
  context: ServerPlugin.RouteContext,
  response: Response,
  message: string
): void {
  context.sendError(
    response,
    context.RESPONSE_CODE_DEFINITIONS.badRequest,
    message
  );
}

function readWorkspacePath(value: unknown): string | undefined {
  const path = readNonEmptyString(value);
  return path && isAbsolute(path) ? path : undefined;
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}
