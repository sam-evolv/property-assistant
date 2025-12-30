import { IS_DEV, FEATURE_FLAGS } from '../config/env';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
  openedAt?: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const circuitBreakerStore = new Map<string, CircuitBreakerState>();

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeMs: number;
  halfOpenRequests: number;
}

export const ROUTE_RATE_LIMITS: Record<string, RateLimitConfig> = {
  '/api/chat': { windowMs: 60000, maxRequests: 30 },
  '/api/houses/resolve': { windowMs: 60000, maxRequests: 100 },
  '/api/purchaser/profile': { windowMs: 60000, maxRequests: 50 },
  '/api/super': { windowMs: 60000, maxRequests: 200 },
  '/api/developer': { windowMs: 60000, maxRequests: 200 },
  'default': { windowMs: 60000, maxRequests: 100 },
};

export const CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeMs: 30000,
  halfOpenRequests: 3,
};

function getRouteKey(route: string): string {
  for (const pattern of Object.keys(ROUTE_RATE_LIMITS)) {
    if (pattern !== 'default' && route.startsWith(pattern)) {
      return pattern;
    }
  }
  return 'default';
}

export function getRateLimitConfig(route: string): RateLimitConfig {
  const key = getRouteKey(route);
  return ROUTE_RATE_LIMITS[key];
}

function sanitizeClientId(clientId: string): string {
  return clientId.replace(/[:|]/g, '_');
}

export function checkRateLimit(
  clientId: string,
  route: string
): { allowed: boolean; remaining: number; resetMs: number } {
  if (IS_DEV && !FEATURE_FLAGS.ENABLE_RATE_LIMITS) {
    return { allowed: true, remaining: 999, resetMs: 0 };
  }
  
  if (!FEATURE_FLAGS.ENABLE_RATE_LIMITS) {
    return { allowed: true, remaining: 999, resetMs: 0 };
  }
  
  const config = getRateLimitConfig(route);
  const safeClientId = sanitizeClientId(clientId);
  const key = `${safeClientId}|${getRouteKey(route)}`;
  const now = Date.now();
  
  let entry = rateLimitStore.get(key);
  
  if (!entry || now - entry.windowStart >= config.windowMs) {
    entry = { count: 0, windowStart: now };
    rateLimitStore.set(key, entry);
  }
  
  const remaining = Math.max(0, config.maxRequests - entry.count);
  const resetMs = config.windowMs - (now - entry.windowStart);
  
  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetMs };
  }
  
  entry.count++;
  return { allowed: true, remaining: remaining - 1, resetMs };
}

export function getCircuitBreakerState(route: string): CircuitBreakerState {
  const key = getRouteKey(route);
  let state = circuitBreakerStore.get(key);
  
  if (!state) {
    state = { failures: 0, lastFailure: 0, state: 'closed' };
    circuitBreakerStore.set(key, state);
  }
  
  return state;
}

export function checkCircuitBreaker(route: string): { allowed: boolean; state: string } {
  if (IS_DEV) {
    return { allowed: true, state: 'closed' };
  }
  
  const key = getRouteKey(route);
  const state = getCircuitBreakerState(route);
  const now = Date.now();
  
  if (state.state === 'open') {
    if (now - (state.openedAt || 0) >= CIRCUIT_BREAKER_CONFIG.resetTimeMs) {
      state.state = 'half-open';
      circuitBreakerStore.set(key, state);
      return { allowed: true, state: 'half-open' };
    }
    return { allowed: false, state: 'open' };
  }
  
  return { allowed: true, state: state.state };
}

export function recordCircuitBreakerSuccess(route: string): void {
  const key = getRouteKey(route);
  const state = getCircuitBreakerState(route);
  
  if (state.state === 'half-open') {
    state.failures = 0;
    state.state = 'closed';
    circuitBreakerStore.set(key, state);
  } else if (state.state === 'closed' && state.failures > 0) {
    state.failures = Math.max(0, state.failures - 1);
    circuitBreakerStore.set(key, state);
  }
}

export function recordCircuitBreakerFailure(route: string): void {
  const key = getRouteKey(route);
  const state = getCircuitBreakerState(route);
  const now = Date.now();
  
  state.failures++;
  state.lastFailure = now;
  
  if (state.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
    state.state = 'open';
    state.openedAt = now;
    console.warn(`[CIRCUIT_BREAKER] Opened for route: ${key} after ${state.failures} failures`);
  }
  
  circuitBreakerStore.set(key, state);
}

export function getRateLimitHeaders(
  remaining: number,
  resetMs: number,
  config: RateLimitConfig
): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(config.maxRequests),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(resetMs / 1000)),
  };
}

export function cleanupExpiredEntries(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  rateLimitStore.forEach((entry, key) => {
    const parts = key.split('|');
    const routeKey = parts.length > 1 ? parts[1] : 'default';
    const config = ROUTE_RATE_LIMITS[routeKey] || ROUTE_RATE_LIMITS.default;
    if (now - entry.windowStart >= config.windowMs * 2) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => rateLimitStore.delete(key));
}

if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredEntries, 60000);
}
