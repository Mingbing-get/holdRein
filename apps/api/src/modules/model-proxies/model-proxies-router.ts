import { Router, type Request, type Response } from "express";

import { sendError, sendSuccess } from "../../response";
import { RESPONSE_CODE_DEFINITIONS } from "../../response/response-codes";
import { getDefaultModelProxiesService } from "./default-model-proxies-service";
import type { ModelProxyRequestInput } from "./model-proxy-repository";
import type { ModelProxiesService } from "./model-proxies-service";

export interface CreateModelProxiesRouterOptions {
  modelProxiesService?: ModelProxiesService;
}

export function createModelProxiesRouter(
  options: CreateModelProxiesRouterOptions = {}
): Router {
  const router = Router();
  const getService = () => options.modelProxiesService ?? getDefaultModelProxiesService();

  router.get("/model-proxies", (_request, response): void => {
    const service = getService();
    sendSuccess(response, service.listProxies());
  });

  router.post(
    "/model-proxies",
    (request: Request<unknown, unknown, ModelProxyRequestInput>, response: Response): void => {
      const service = getService();
      try {
        sendSuccess(response, service.createProxy(request.body));
      } catch (error) {
        sendError(response, RESPONSE_CODE_DEFINITIONS.badRequest, toErrorMessage(error));
      }
    }
  );

  router.get(
    "/model-proxies/:modelId",
    (request: Request<{ modelId: string }>, response: Response): void => {
      const proxy = getService()?.findProxy(String(request.params.modelId ?? ""));
      if (!proxy) {
        sendError(response, RESPONSE_CODE_DEFINITIONS.notFound, "Unknown proxy model");
        return;
      }
      sendSuccess(response, proxy);
    }
  );

  router.put(
    "/model-proxies/:modelId",
    (
      request: Request<{ modelId: string }, unknown, ModelProxyRequestInput>,
      response: Response
    ): void => {
      const service = getService();
      try {
        const proxy = service.updateProxy(String(request.params.modelId ?? ""), request.body);
        if (!proxy) {
          sendError(response, RESPONSE_CODE_DEFINITIONS.notFound, "Unknown proxy model");
          return;
        }
        sendSuccess(response, proxy);
      } catch (error) {
        sendError(response, RESPONSE_CODE_DEFINITIONS.badRequest, toErrorMessage(error));
      }
    }
  );

  router.delete(
    "/model-proxies/:modelId",
    (request: Request<{ modelId: string }>, response: Response): void => {
      const modelId = String(request.params.modelId ?? "");
      if (!getService()?.deleteProxy(modelId)) {
        sendError(response, RESPONSE_CODE_DEFINITIONS.notFound, "Unknown proxy model");
        return;
      }
      sendSuccess(response, { modelId });
    }
  );

  return router;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Model proxy request failed";
}
