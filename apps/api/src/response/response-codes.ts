export interface ResponseCodeDefinition {
  code: number;
  defaultMessage: string;
  description: string;
  httpStatus: number;
}

export const RESPONSE_CODE_DEFINITIONS = {
  success: {
    code: 0,
    defaultMessage: "ok",
    description: "Request succeeded.",
    httpStatus: 200
  },
  badRequest: {
    code: 40000,
    defaultMessage: "Bad Request",
    description: "Request parameters or body are invalid.",
    httpStatus: 400
  },
  unauthorized: {
    code: 40100,
    defaultMessage: "Unauthorized",
    description: "Authentication is required or has failed.",
    httpStatus: 401
  },
  forbidden: {
    code: 40300,
    defaultMessage: "Forbidden",
    description: "The current user does not have access to this resource.",
    httpStatus: 403
  },
  notFound: {
    code: 40400,
    defaultMessage: "Not Found",
    description: "The requested resource does not exist.",
    httpStatus: 404
  },
  conflict: {
    code: 40900,
    defaultMessage: "Conflict",
    description: "The request conflicts with the current resource state.",
    httpStatus: 409
  },
  internalError: {
    code: 50000,
    defaultMessage: "Internal Server Error",
    description: "The server encountered an unexpected error.",
    httpStatus: 500
  }
} as const satisfies Record<string, ResponseCodeDefinition>;

export type ResponseCodeKey = keyof typeof RESPONSE_CODE_DEFINITIONS;
