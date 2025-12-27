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
  context: string,
  message: string,
  requestId: string,
  data?: Record<string, unknown>
): void {
  incrementCriticalError();
  const logEntry = {
    level: 'CRITICAL',
    context,
    message,
    request_id: requestId,
    timestamp: new Date().toISOString(),
    ...data,
  };
  console.error(`[APP CRITICAL] ${context}: ${message} requestId=${requestId}`, JSON.stringify(logEntry));
}

export function logError(
  context: string,
  message: string,
  requestId: string,
  error?: unknown
): void {
  const errorMessage = error instanceof Error ? error.message : String(error || '');
  console.error(`[${context}] ERROR: ${message} requestId=${requestId}`, errorMessage);
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
