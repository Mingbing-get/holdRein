import type { NextFunction, Request, Response } from "express";

import { RESPONSE_CODE_DEFINITIONS, sendError } from "../response";

export function errorMiddleware(
  error: Error,
  _request: Request,
  response: Response,
  _next: NextFunction
): void {
  void _next;

  sendError(
    response,
    RESPONSE_CODE_DEFINITIONS.internalError,
    error.message || RESPONSE_CODE_DEFINITIONS.internalError.defaultMessage
  );
}
