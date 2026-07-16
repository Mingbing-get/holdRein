import type { WebPlugin } from "@hold-rein/plugin-web";

import {
  isSelfApiPathAllowed,
  normalizeSelfApiPath,
  type SelfApiMethod
} from "../shared/self-api-catalog";

export function createRequestSelfApiTool(
  request: WebPlugin.RuntimeContext["request"]
): WebPlugin.BrowserRuntimeTool {
  return {
    description:
      "Request an allowed Hold Rein /api/v1 endpoint using a relative path such as /model-providers.",
    executor: async ({ arguments: args }) => {
      const input = parseRequestSelfApiInput(args);
      const result = await request<unknown>({
        ...(input.body === undefined
          ? {}
          : {
              body: JSON.stringify(input.body),
              headers: { "Content-Type": "application/json" }
            }),
        method: input.method,
        path: input.path,
        ...(input.query === undefined ? {} : { query: input.query })
      });

      return JSON.stringify(result, null, 2);
    },
    name: "requestSelfApi",
    params: {
      additionalProperties: false,
      properties: {
        body: {
          description: "Optional JSON-compatible request body.",
          type: ["array", "boolean", "null", "number", "object", "string"]
        },
        method: {
          description: "HTTP method for the API request.",
          enum: ["DELETE", "GET", "PATCH", "POST", "PUT"],
          type: "string"
        },
        path: {
          description:
            "API path beginning with /api/v1, such as /api/v1/model-providers.",
          type: "string"
        },
        query: {
          additionalProperties: {
            type: ["boolean", "number", "string"]
          },
          description: "Optional query parameters.",
          type: "object"
        }
      },
      required: ["method", "path"],
      type: "object"
    } as WebPlugin.BrowserRuntimeTool["params"]
  };
}

interface RequestSelfApiInput {
  readonly body?: unknown;
  readonly method: SelfApiMethod;
  readonly path: string;
  readonly query?: Record<string, WebPlugin.RequestQueryValue>;
}

function parseRequestSelfApiInput(
  value: Record<string, unknown>
): RequestSelfApiInput {
  const method = value.method;
  if (!isSelfApiMethod(method)) {
    throw new Error("method must be DELETE, GET, PATCH, POST, or PUT.");
  }

  if (typeof value.path !== "string") {
    throw new Error("path must be a string.");
  }

  const path = normalizeSelfApiPath(value.path);
  if (path === null) {
    throw new Error("path must begin with /api/v1 and must not include a host.");
  }

  if (!isSelfApiPathAllowed(path)) {
    throw new Error(`Self API path is not allowed: ${value.path}`);
  }

  const query = parseQuery(value.query);

  return {
    ...(value.body === undefined ? {} : { body: value.body }),
    method,
    path,
    ...(query === undefined ? {} : { query })
  };
}

function isSelfApiMethod(value: unknown): value is SelfApiMethod {
  return value === "DELETE" || value === "GET" || value === "PATCH" ||
    value === "POST" || value === "PUT";
}

function parseQuery(
  value: unknown
): Record<string, WebPlugin.RequestQueryValue> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("query must be an object when provided.");
  }

  const result: Record<string, WebPlugin.RequestQueryValue> = {};
  for (const [key, queryValue] of Object.entries(value)) {
    if (
      queryValue !== undefined &&
      typeof queryValue !== "boolean" &&
      typeof queryValue !== "number" &&
      typeof queryValue !== "string"
    ) {
      throw new Error("query values must be strings, numbers, booleans, or undefined.");
    }
    result[key] = queryValue;
  }

  return result;
}
