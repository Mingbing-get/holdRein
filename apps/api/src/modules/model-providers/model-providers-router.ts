import { Router, type Request, type Response } from "express";

import { sendError, sendSuccess } from "../../response";
import { RESPONSE_CODE_DEFINITIONS } from "../../response/response-codes";
import { getDefaultModelProvidersService } from "./default-model-provider-service";
import type { ModelProvidersService } from "./model-providers-service";

export interface CreateModelProvidersRouterOptions {
  service?: ModelProvidersService;
}

interface SetProviderApiKeyBody {
  apiKey?: string;
}

interface CustomModelProviderBody {
  baseUrl?: string;
  provider?: string;
}

interface CustomProviderModelBody {
  api?: string;
  contextWindow?: number;
  input?: string[];
  maxTokens?: number;
  modelId?: string;
  name?: string;
  reasoning?: boolean;
}

export function createModelProvidersRouter(
  options: CreateModelProvidersRouterOptions = {}
): Router {
  const router = Router();
  const getService = (): ModelProvidersService =>
    options.service ?? getDefaultModelProvidersService();

  router.get(
    "/model-providers",
    (_request: Request, response: Response): void => {
      sendSuccess(response, getService().listModelProviders());
    }
  );

  router.post(
    "/model-providers/custom",
    (
      request: Request<unknown, unknown, CustomModelProviderBody>,
      response: Response
    ): void => {
      if (
        typeof request.body.provider !== "string" ||
        typeof request.body.baseUrl !== "string"
      ) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "provider and baseUrl must be strings"
        );
        return;
      }

      try {
        sendSuccess(
          response,
          getService().createCustomModelProvider(
            request.body.provider,
            request.body.baseUrl
          )
        );
      } catch (error) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          error instanceof Error ? error.message : "Failed to create provider"
        );
      }
    }
  );

  router.put(
    "/model-providers/custom/:provider",
    (
      request: Request<{ provider: string }, unknown, CustomModelProviderBody>,
      response: Response
    ): void => {
      if (
        typeof request.body.provider !== "string" ||
        typeof request.body.baseUrl !== "string"
      ) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "provider and baseUrl must be strings"
        );
        return;
      }

      try {
        const updatedProvider = getService().updateCustomModelProvider(
          String(request.params.provider ?? ""),
          request.body.provider,
          request.body.baseUrl
        );

        if (!updatedProvider) {
          sendError(
            response,
            RESPONSE_CODE_DEFINITIONS.notFound,
            "Unknown custom provider"
          );
          return;
        }

        sendSuccess(response, updatedProvider);
      } catch (error) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          error instanceof Error ? error.message : "Failed to update provider"
        );
      }
    }
  );

  router.delete(
    "/model-providers/custom/:provider",
    (
      request: Request<{ provider: string }>,
      response: Response
    ): void => {
      const provider = String(request.params.provider ?? "");
      const deleted = getService().deleteCustomModelProvider(provider);

      if (!deleted) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.notFound,
          "Unknown custom provider"
        );
        return;
      }

      sendSuccess(response, { provider });
    }
  );

  router.get(
    "/model-providers/:provider/models",
    (request: Request, response: Response): void => {
      const provider = String(request.params.provider ?? "");
      const service = getService();

      if (!service.hasProvider(provider)) {
        sendError(response, RESPONSE_CODE_DEFINITIONS.notFound, "Unknown provider");
        return;
      }

      sendSuccess(response, service.listModelsForProvider(provider));
    }
  );

  router.post(
    "/model-providers/:provider/models",
    (
      request: Request<{ provider: string }, unknown, CustomProviderModelBody>,
      response: Response
    ): void => {
      if (!isValidCreateModelBody(request.body)) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "api, modelId, name, input, contextWindow, maxTokens and reasoning are required"
        );
        return;
      }

      try {
        sendSuccess(
          response,
          getService().createCustomProviderModel(String(request.params.provider ?? ""), {
            api: request.body.api,
            contextWindow: request.body.contextWindow,
            input: request.body.input,
            maxTokens: request.body.maxTokens,
            modelId: request.body.modelId,
            name: request.body.name,
            reasoning: request.body.reasoning
          })
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create model";
        const code =
          message === "Unknown custom provider"
            ? RESPONSE_CODE_DEFINITIONS.notFound
            : RESPONSE_CODE_DEFINITIONS.badRequest;

        sendError(response, code, message);
      }
    }
  );

  router.put(
    "/model-providers/:provider/models/:modelId",
    (
      request: Request<
        { modelId: string; provider: string },
        unknown,
        CustomProviderModelBody
      >,
      response: Response
    ): void => {
      if (!isValidUpdateModelBody(request.body)) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "api, name, input, contextWindow, maxTokens and reasoning are required"
        );
        return;
      }

      const updatedModel = getService().updateCustomProviderModel(
        String(request.params.provider ?? ""),
        String(request.params.modelId ?? ""),
        {
          api: request.body.api,
          contextWindow: request.body.contextWindow,
          input: request.body.input,
          maxTokens: request.body.maxTokens,
          name: request.body.name,
          reasoning: request.body.reasoning
        }
      );

      if (!updatedModel) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.notFound,
          "Unknown custom model"
        );
        return;
      }

      sendSuccess(response, updatedModel);
    }
  );

  router.delete(
    "/model-providers/:provider/models/:modelId",
    (
      request: Request<{ modelId: string; provider: string }>,
      response: Response
    ): void => {
      const provider = String(request.params.provider ?? "");
      const modelId = String(request.params.modelId ?? "");
      const deleted = getService().deleteCustomProviderModel(provider, modelId);

      if (!deleted) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.notFound,
          "Unknown custom model"
        );
        return;
      }

      sendSuccess(response, {
        modelId,
        provider
      });
    }
  );

  router.put(
    "/model-providers/:provider/api-key",
    (
      request: Request<{ provider: string }, unknown, SetProviderApiKeyBody>,
      response: Response
    ): void => {
      const provider = String(request.params.provider ?? "");
      const service = getService();

      if (!service.hasProvider(provider)) {
        sendError(response, RESPONSE_CODE_DEFINITIONS.notFound, "Unknown provider");
        return;
      }

      if (typeof request.body.apiKey !== "string") {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.badRequest,
          "apiKey must be a string"
        );
        return;
      }

      try {
        const providerSummary = service.storeProviderApiKey(
          provider,
          request.body.apiKey
        );

        sendSuccess(response, {
          hasApiKey: providerSummary.hasApiKey,
          provider: providerSummary.id
        });
      } catch (error) {
        sendError(
          response,
          RESPONSE_CODE_DEFINITIONS.internalError,
          error instanceof Error ? error.message : "Failed to store apiKey"
        );
      }
    }
  );

  return router;
}

function isValidCreateModelBody(
  body: CustomProviderModelBody
): body is Required<CustomProviderModelBody> {
  return (
    typeof body.api === "string" &&
    typeof body.modelId === "string" &&
    typeof body.name === "string" &&
    Array.isArray(body.input) &&
    body.input.every((item) => typeof item === "string") &&
    typeof body.contextWindow === "number" &&
    typeof body.maxTokens === "number" &&
    typeof body.reasoning === "boolean"
  );
}

function isValidUpdateModelBody(
  body: CustomProviderModelBody
): body is Omit<Required<CustomProviderModelBody>, "modelId"> {
  return (
    typeof body.api === "string" &&
    typeof body.name === "string" &&
    Array.isArray(body.input) &&
    body.input.every((item) => typeof item === "string") &&
    typeof body.contextWindow === "number" &&
    typeof body.maxTokens === "number" &&
    typeof body.reasoning === "boolean"
  );
}
