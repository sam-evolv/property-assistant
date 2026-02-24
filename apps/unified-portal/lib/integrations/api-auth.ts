/**
 * API Gateway Authentication Middleware
 *
 * Authenticates incoming API requests using Bearer token (API key).
 * Handles key validation, scope checking, and rate limiting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getRateLimitHeaders } from './security/rate-limiter';
import { logAudit } from './security/audit';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface ApiKeyContext {
  tenant_id: string;
  scopes: string[];
  allowed_developments: string[] | null;
  key_id: string;
  key_prefix: string;
}

/**
 * Authenticate an API request using a Bearer token.
 * Returns the API key context if valid, null otherwise.
 */
export async function authenticateApiKey(request: NextRequest): Promise<ApiKeyContext | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer oh_live_')) return null;

  const providedKey = authHeader.replace('Bearer ', '');
  const keyPrefix = providedKey.slice(0, 16);

  const supabase = getSupabaseAdmin();

  // Find candidate keys by prefix
  const { data: candidates } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_prefix', keyPrefix)
    .eq('is_active', true);

  if (!candidates?.length) return null;

  // bcryptjs is used for key hashing — compare hash
  // Since we can't use bcrypt in edge, we do a constant-time comparison approach:
  // The key_hash stores a bcrypt hash; we need the bcryptjs library for compare
  const { compare } = await import('bcryptjs');

  for (const candidate of candidates) {
    const isMatch = await compare(providedKey, candidate.key_hash);
    if (!isMatch) continue;

    // Check expiry
    if (candidate.expires_at && new Date(candidate.expires_at) < new Date()) {
      return null;
    }

    // Update last_used_at
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', candidate.id);

    // Log the access
    await logAudit(candidate.tenant_id, 'api.authenticated', 'api_key', {
      key_prefix: keyPrefix,
      ip: request.headers.get('x-forwarded-for'),
    });

    return {
      tenant_id: candidate.tenant_id,
      scopes: candidate.scopes,
      allowed_developments: candidate.allowed_developments,
      key_id: candidate.id,
      key_prefix: keyPrefix,
    };
  }

  return null;
}

/**
 * Check if the API key context has the required scope.
 */
export function hasScope(ctx: ApiKeyContext, requiredScope: string): boolean {
  if (ctx.scopes.includes('admin')) return true;
  return ctx.scopes.includes(requiredScope);
}

/**
 * Check if the API key context has access to a specific development.
 */
export function hasDevelopmentAccess(ctx: ApiKeyContext, developmentId: string): boolean {
  if (!ctx.allowed_developments || ctx.allowed_developments.length === 0) return true;
  return ctx.allowed_developments.includes(developmentId);
}

/**
 * Middleware wrapper for API routes that require API key authentication.
 */
export async function withApiAuth(
  request: NextRequest,
  handler: (ctx: ApiKeyContext) => Promise<NextResponse>,
  requiredScope?: string
): Promise<NextResponse> {
  // Authenticate
  const ctx = await authenticateApiKey(request);
  if (!ctx) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Invalid or missing API key' },
      { status: 401 }
    );
  }

  // Check scope
  if (requiredScope && !hasScope(ctx, requiredScope)) {
    return NextResponse.json(
      { error: 'Forbidden', message: `Requires '${requiredScope}' scope` },
      { status: 403 }
    );
  }

  // Rate limit
  const rateLimitResult = checkRateLimit(ctx.key_id, 60);
  if (!rateLimitResult.allowed) {
    const headers = getRateLimitHeaders(rateLimitResult);
    return NextResponse.json(
      { error: 'Rate limit exceeded', retry_after: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000) },
      { status: 429, headers }
    );
  }

  // Log the request
  await logAudit(ctx.tenant_id, 'api.request', 'api_key', {
    key_prefix: ctx.key_prefix,
    method: request.method,
    path: request.nextUrl.pathname,
    ip: request.headers.get('x-forwarded-for'),
  });

  // Execute handler
  const response = await handler(ctx);

  // Add rate limit headers
  const headers = getRateLimitHeaders(rateLimitResult);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  return response;
}
