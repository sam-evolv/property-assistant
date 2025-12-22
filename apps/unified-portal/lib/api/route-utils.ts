import { NextRequest, NextResponse } from 'next/server';
import { ErrorCodes, normalizeError, getHttpStatus, createAPIError, type ErrorCode } from './errors';

export interface RouteGuardOptions {
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  requireAuth?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

const DEFAULT_OPTIONS: Required<RouteGuardOptions> = {
  timeoutMs: 10000,
  maxRetries: 2,
  retryDelayMs: 100,
  requireAuth: false,
  logLevel: 'info',
};

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

type RouteHandler = (
  request: NextRequest,
  context: { params?: Record<string, string>; requestId: string }
) => Promise<NextResponse>;

export function withRouteGuard(
  handler: RouteHandler,
  options: RouteGuardOptions = {}
) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return async (
    request: NextRequest,
    context?: { params?: Record<string, string> }
  ): Promise<NextResponse> => {
    const requestId = request.headers.get('x-request-id') || generateRequestId();
    const startTime = Date.now();
    const route = request.nextUrl.pathname;
    const method = request.method;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs);

        const resultPromise = handler(request, { 
          params: context?.params || {}, 
          requestId 
        });

        const result = await Promise.race([
          resultPromise,
          new Promise<never>((_, reject) => {
            controller.signal.addEventListener('abort', () => {
              reject(new Error('timeout'));
            });
          }),
        ]);

        clearTimeout(timeoutId);

        const duration = Date.now() - startTime;
        const status = result.status;

        if (opts.logLevel !== 'error') {
          console.log(`[API] ${method} ${route} ${status} ${duration}ms requestId=${requestId}`);
        }

        const responseHeaders = new Headers(result.headers);
        responseHeaders.set('x-request-id', requestId);
        responseHeaders.set('x-response-time', `${duration}ms`);

        return new NextResponse(result.body, {
          status: result.status,
          statusText: result.statusText,
          headers: responseHeaders,
        });

      } catch (error: any) {
        lastError = error;
        const duration = Date.now() - startTime;

        if (error.message === 'timeout') {
          console.error(`[API] ${method} ${route} TIMEOUT after ${duration}ms requestId=${requestId} attempt=${attempt + 1}`);
        } else {
          console.error(`[API] ${method} ${route} ERROR after ${duration}ms requestId=${requestId} attempt=${attempt + 1}:`, error.message);
        }

        const isRetryable = 
          error.message === 'timeout' ||
          error.message?.includes('ECONNRESET') ||
          error.message?.includes('connection') ||
          error.code === '57P01';

        if (attempt < opts.maxRetries && isRetryable) {
          const delay = opts.retryDelayMs * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }

        break;
      }
    }

    const duration = Date.now() - startTime;
    const apiError = normalizeError(lastError, requestId);

    console.error(`[API] ${method} ${route} FAILED after ${duration}ms requestId=${requestId} code=${apiError.code}`);

    return NextResponse.json(
      { error: apiError.code, message: apiError.message, requestId },
      { 
        status: getHttpStatus(apiError.code),
        headers: { 
          'x-request-id': requestId,
          'x-response-time': `${duration}ms`,
        },
      }
    );
  };
}

export function apiError(
  code: ErrorCode, 
  message: string, 
  requestId?: string
): NextResponse {
  const error = createAPIError(code, message, requestId);
  return NextResponse.json(
    { error: error.code, message: error.message, requestId },
    { 
      status: getHttpStatus(code),
      headers: requestId ? { 'x-request-id': requestId } : {},
    }
  );
}

export function apiSuccess<T>(
  data: T, 
  requestId?: string,
  status: number = 200
): NextResponse {
  return NextResponse.json(data, { 
    status,
    headers: requestId ? { 'x-request-id': requestId } : {},
  });
}
