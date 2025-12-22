export const ErrorCodes = {
  TIMEOUT: 'TIMEOUT',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  UPSTREAM_FAIL: 'UPSTREAM_FAIL',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export interface APIError {
  code: ErrorCode;
  message: string;
  requestId?: string;
}

export function createAPIError(code: ErrorCode, message: string, requestId?: string): APIError {
  return { code, message, requestId };
}

export function normalizeError(error: unknown, requestId?: string): APIError {
  if (error instanceof Error) {
    if (error.message.includes('timeout') || error.name === 'AbortError') {
      return createAPIError(ErrorCodes.TIMEOUT, 'Request timed out', requestId);
    }
    if (error.message.includes('unauthorized') || error.message.includes('UNAUTHORIZED')) {
      return createAPIError(ErrorCodes.UNAUTHENTICATED, 'Authentication required', requestId);
    }
    if (error.message.includes('forbidden') || error.message.includes('FORBIDDEN')) {
      return createAPIError(ErrorCodes.FORBIDDEN, 'Access denied', requestId);
    }
    if (error.message.includes('not found')) {
      return createAPIError(ErrorCodes.NOT_FOUND, 'Resource not found', requestId);
    }
    return createAPIError(ErrorCodes.INTERNAL, 'An unexpected error occurred', requestId);
  }
  return createAPIError(ErrorCodes.INTERNAL, 'An unexpected error occurred', requestId);
}

export function getHttpStatus(code: ErrorCode): number {
  switch (code) {
    case ErrorCodes.BAD_REQUEST:
      return 400;
    case ErrorCodes.UNAUTHENTICATED:
      return 401;
    case ErrorCodes.FORBIDDEN:
      return 403;
    case ErrorCodes.NOT_FOUND:
      return 404;
    case ErrorCodes.RATE_LIMITED:
      return 429;
    case ErrorCodes.TIMEOUT:
      return 504;
    case ErrorCodes.UPSTREAM_FAIL:
      return 502;
    case ErrorCodes.INTERNAL:
    default:
      return 500;
  }
}
