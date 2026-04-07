/**
 * CSRF Protection Middleware
 *
 * Validates CSRF tokens on state-changing requests (POST, PUT, DELETE, PATCH).
 * Tokens are passed via the X-CSRF-Token header.
 *
 * Usage in a route:
 *   import { requireCsrf } from '@/lib/csrf';
 *
 *   export async function POST(req: NextRequest) {
 *     const csrfError = requireCsrf(req);
 *     if (csrfError) return csrfError;
 *     // ... route logic
 *   }
 *
 * Routes that require CSRF tokens:
 * - POST /api/purchaser/mark-handover
 * - POST /api/purchaser/important-docs-agreement
 * - POST /api/purchaser/notes
 * - POST /api/purchaser/noticeboard/report
 * - POST /api/onboarding/submit
 * - POST /api/theme/save
 *
 * Routes that do NOT need CSRF:
 * - Auth routes (login, logout, validate-code) — initial authentication
 * - Routes protected by withAuth middleware — session cookie validation is sufficient
 * - Public API routes
 * - GET requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateCsrfToken } from '@/lib/security/validation';

/**
 * Validate the CSRF token on a request. Returns a 403 NextResponse if
 * invalid, or null if the token is valid.
 */
export function requireCsrf(req: NextRequest): NextResponse | null {
  const token = req.headers.get('x-csrf-token');

  if (!token) {
    return NextResponse.json(
      { error: 'Missing CSRF token' },
      { status: 403 },
    );
  }

  if (!validateCsrfToken(token)) {
    return NextResponse.json(
      { error: 'Invalid or expired CSRF token' },
      { status: 403 },
    );
  }

  return null;
}
