import { NextResponse } from 'next/server';
import { generateCsrfToken } from '@/lib/security/validation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/csrf
 *
 * Returns a fresh CSRF token. Clients should call this before making
 * state-changing requests to CSRF-protected endpoints and include the
 * token in the X-CSRF-Token header.
 */
export async function GET() {
  const token = generateCsrfToken();
  return NextResponse.json({ csrfToken: token });
}
