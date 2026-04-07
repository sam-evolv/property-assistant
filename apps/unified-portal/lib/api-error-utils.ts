import { incrementCriticalError } from './system-health';

export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

export interface StructuredApiError {
  error: string;
  error_code?: string;
  request_id: string;
  timestamp: string;
  details?: string | string[];
  retryable?: boolean;
}

export function createStructuredError(
  errorMessage: string,
  requestId: string,
  options?: {
    error_code?: string;
    details?: string | string[];
    retryable?: boolean;
  }
): StructuredApiError {
  return {
    error: errorMessage,
    error_code: options?.error_code,
    request_id: requestId,
    timestamp: new Date().toISOString(),
    details: options?.details,
    retryable: options?.retryable,
  };
}

export function logCritical(
  _context: string,
  _message: string,
  _requestId: string,
  _data?: Record<string, unknown>
): void {
  incrementCriticalError();
}

export function logError(
  _context: string,
  _message: string,
  _requestId: string,
  _error?: unknown
): void {
  // No-op: console output removed
}

export function getResponseHeaders(requestId: string): HeadersInit {
  return {
    'x-request-id': requestId,
    'Content-Type': 'application/json',
  };
}

export function isConnectionPoolError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message || '';
  return (
    msg.includes('MaxClients') ||
    msg.includes('pool') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT') ||
    (error as any).code === 'XX000'
  );
}
