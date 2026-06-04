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
