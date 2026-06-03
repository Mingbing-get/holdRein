import type { Request, Response } from "express";

import { RESPONSE_CODE_DEFINITIONS, sendError } from "../response";

export function notFoundMiddleware(_request: Request, response: Response): void {
  sendError(response, RESPONSE_CODE_DEFINITIONS.notFound);
}
