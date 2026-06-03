import type { Response } from "express";

import {
  RESPONSE_CODE_DEFINITIONS,
  type ResponseCodeDefinition
} from "./response-codes";

export interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T;
}

export function createApiResponse<T>(
  definition: ResponseCodeDefinition,
  data: T,
  message = definition.defaultMessage
): ApiResponse<T> {
  return {
    code: definition.code,
    msg: message,
    data
  };
}

export function sendSuccess<T>(
  response: Response,
  data: T,
  message?: string
): void {
  response
    .status(RESPONSE_CODE_DEFINITIONS.success.httpStatus)
    .json(createApiResponse(RESPONSE_CODE_DEFINITIONS.success, data, message));
}

export function sendError(
  response: Response,
  definition: ResponseCodeDefinition,
  message?: string
): void {
  response
    .status(definition.httpStatus)
    .json(createApiResponse(definition, null, message));
}
