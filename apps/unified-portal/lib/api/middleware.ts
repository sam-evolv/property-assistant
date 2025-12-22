import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { ErrorCodes, getHttpStatus } from './errors';

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         request.headers.get('x-real-ip') ||
         request.ip ||
         '127.0.0.1';
}

export interface APIContext {
  requestId: string;
  clientIP: string;
  startTime: number;
}

export function withAPIMiddleware<T>(
  handler: (request: NextRequest, context: APIContext) => Promise<NextResponse<T>>,
  options: { rateLimit?: boolean; timeout?: number } = {}
) {
  const { rateLimit = true, timeout = 30000 } = options;

  return async (request: NextRequest, routeContext?: { params?: Record<string, string> }): Promise<NextResponse> => {
    const requestId = request.headers.get('x-request-id') || generateRequestId();
    const clientIP = getClientIP(request);
    const startTime = Date.now();
    const route = request.nextUrl.pathname;

    if (rateLimit) {
      const rateLimitResult = checkRateLimit(clientIP, route);
      if (!rateLimitResult.allowed) {
        console.log(`[API] Rate limit exceeded: ${clientIP} on ${route}`);
        return NextResponse.json(
          { 
            error: ErrorCodes.RATE_LIMITED, 
            message: 'Too many requests. Please try again later.',
            requestId,
            retryAfterMs: rateLimitResult.resetMs,
          },
          { 
            status: getHttpStatus(ErrorCodes.RATE_LIMITED),
            headers: {
              'x-request-id': requestId,
              'x-ratelimit-remaining': String(rateLimitResult.remaining),
              'retry-after': String(Math.ceil(rateLimitResult.resetMs / 1000)),
            },
          }
        );
      }
    }

    try {
      const result = await handler(request, { requestId, clientIP, startTime });
      
      const duration = Date.now() - startTime;
      const status = result.status;
      
      console.log(`[API] ${request.method} ${route} ${status} ${duration}ms requestId=${requestId}`);

      const headers = new Headers(result.headers);
      headers.set('x-request-id', requestId);
      headers.set('x-response-time', `${duration}ms`);

      return new NextResponse(result.body, {
        status: result.status,
        statusText: result.statusText,
        headers,
      });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[API] ${request.method} ${route} ERROR ${duration}ms requestId=${requestId}:`, error.message);
      
      return NextResponse.json(
        { 
          error: ErrorCodes.INTERNAL, 
          message: 'An unexpected error occurred',
          requestId,
        },
        { 
          status: 500,
          headers: {
            'x-request-id': requestId,
            'x-response-time': `${duration}ms`,
          },
        }
      );
    }
  };
}

export function addRequestHeaders(response: NextResponse, requestId: string, startTime: number): NextResponse {
  const duration = Date.now() - startTime;
  response.headers.set('x-request-id', requestId);
  response.headers.set('x-response-time', `${duration}ms`);
  return response;
}
