import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkRateLimit, checkCircuitBreaker, getRateLimitHeaders, getRateLimitConfig, recordCircuitBreakerSuccess, recordCircuitBreakerFailure } from './lib/security/rate-limiter';
import { generateRequestId, determineActorType, logAudit } from './lib/logging/audit';
import { FEATURE_FLAGS, APP_ENV } from './lib/config/env';

const PROTECTED_ROUTES = [
  '/api/chat',
  '/api/houses',
  '/api/purchaser',
  '/api/super',
  '/api/developer',
  '/api/admin',
];

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(route => pathname.startsWith(route));
}

export function safetyMiddleware(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  
  if (!pathname.startsWith('/api/')) {
    return null;
  }
  
  const requestId = request.headers.get('x-request-id') || generateRequestId();
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
  
  if (isProtectedRoute(pathname)) {
    const circuitCheck = checkCircuitBreaker(pathname);
    if (!circuitCheck.allowed) {
      logAudit({
        eventName: 'circuit_breaker_reject',
        actorType: determineActorType(request.headers),
        requestId,
        route: pathname,
        method: request.method,
        metadata: { circuitState: circuitCheck.state },
      });
      
      return new NextResponse(
        JSON.stringify({
          error: 'Service temporarily unavailable',
          code: 'CIRCUIT_OPEN',
          requestId,
        }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
            'Retry-After': '30',
          },
        }
      );
    }
    
    if (FEATURE_FLAGS.ENABLE_RATE_LIMITS) {
      const rateCheck = checkRateLimit(clientIp, pathname);
      
      if (!rateCheck.allowed) {
        logAudit({
          eventName: 'rate_limit_exceeded',
          actorType: determineActorType(request.headers),
          requestId,
          route: pathname,
          method: request.method,
          metadata: { clientIp: clientIp.substring(0, 10) + '...' },
        });
        
        const config = getRateLimitConfig(pathname);
        const headers = getRateLimitHeaders(rateCheck.remaining, rateCheck.resetMs, config);
        
        return new NextResponse(
          JSON.stringify({
            error: 'Too many requests',
            code: 'RATE_LIMIT_EXCEEDED',
            requestId,
            retryAfter: Math.ceil(rateCheck.resetMs / 1000),
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'X-Request-ID': requestId,
              ...headers,
            },
          }
        );
      }
    }
  }
  
  const response = NextResponse.next();
  response.headers.set('X-Request-ID', requestId);
  response.headers.set('X-Environment', APP_ENV);
  
  return response;
}

export function withSafetyHeaders(response: NextResponse, requestId: string): NextResponse {
  response.headers.set('X-Request-ID', requestId);
  response.headers.set('X-Environment', APP_ENV);
  return response;
}

export function recordApiResult(pathname: string, success: boolean): void {
  if (success) {
    recordCircuitBreakerSuccess(pathname);
  } else {
    recordCircuitBreakerFailure(pathname);
  }
}

export function wrapApiHandler<T>(
  pathname: string,
  handler: () => Promise<T>
): Promise<T> {
  return handler()
    .then((result) => {
      recordCircuitBreakerSuccess(pathname);
      return result;
    })
    .catch((error) => {
      recordCircuitBreakerFailure(pathname);
      throw error;
    });
}
