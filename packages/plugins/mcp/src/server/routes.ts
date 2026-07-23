import { Router, type Response } from "express";
import type { ServerPlugin } from "@hold-rein/plugin-server";

import { McpServerConfigService } from "./service";
import type { McpServerConfigInput } from "./types";

const ALLOWED_BODY_KEYS = new Set([
  "args",
  "command",
  "enabled",
  "env",
  "headers",
  "name",
  "transport",
  "url"
]);

export interface CreateMcpRouterOptions {
  readonly service?: McpServerConfigService;
}

export default function createRouter(
  context: ServerPlugin.RouteContext,
  options: CreateMcpRouterOptions = {}
): Router {
  const router = Router();
  const service = options.service ?? new McpServerConfigService();

  router.get("/servers", async (_request, response) => {
    await runOperation(context, response, async () => {
      context.sendSuccess(response, service.listServerConfigs());
    });
  });

  router.put("/servers/:id", async (request, response) => {
    await runOperation(context, response, async () => {
      const input = parseConfigInput(request.body);
      context.sendSuccess(
        response,
        service.saveServerConfig(request.params.id, input)
      );
    });
  });

  router.delete("/servers/:id", async (request, response) => {
    await runOperation(context, response, async () => {
      context.sendSuccess(response, {
        deleted: service.deleteServerConfig(request.params.id)
      });
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
    const message = error instanceof Error ? error.message : "MCP route failed";
    if (isBadRequestMessage(message)) {
      sendBadRequest(context, response, message);
      return;
    }

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

function isBadRequestMessage(message: string): boolean {
  return (
    message.includes("required") ||
    message.includes("Unexpected field") ||
    message.includes("must be")
  );
}

function parseConfigInput(body: unknown): McpServerConfigInput {
  if (!isRecord(body)) {
    throw new Error("Request body must be an object");
  }

  for (const key of Object.keys(body)) {
    if (!ALLOWED_BODY_KEYS.has(key)) {
      throw new Error(`Unexpected field: ${key}`);
    }
  }

  if (typeof body.name !== "string") {
    throw new Error("name is required");
  }

  if (
    body.transport !== "stdio" &&
    body.transport !== "http" &&
    body.transport !== "sse"
  ) {
    throw new Error("transport must be stdio, http, or sse");
  }

  return withoutUndefined({
    args: readStringArray(body.args, "args"),
    command: readOptionalString(body.command, "command"),
    enabled: readOptionalBoolean(body.enabled, "enabled"),
    env: readSecretRecord(body.env, "env"),
    headers: readStringRecord(body.headers, "headers"),
    name: body.name,
    transport: body.transport,
    url: readOptionalString(body.url, "url")
  }) as McpServerConfigInput;
}

function readStringArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${field} must be an array of strings`);
  }

  return value;
}

function readOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }

  return value;
}

function readOptionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${field} must be a boolean`);
  }

  return value;
}

function readStringRecord(
  value: unknown,
  field: string
): Record<string, string> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`${field} must be an object`);
  }

  for (const entry of Object.values(value)) {
    if (typeof entry !== "string") {
      throw new Error(`${field} values must be strings`);
    }
  }

  return value as Record<string, string>;
}

function readSecretRecord(
  value: unknown,
  field: string
): Record<string, string | null> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`${field} must be an object`);
  }

  for (const entry of Object.values(value)) {
    if (entry !== null && typeof entry !== "string") {
      throw new Error(`${field} values must be strings or null`);
    }
  }

  return value as Record<string, string | null>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter((entry) => entry[1] !== undefined)
  ) as Partial<T>;
}
