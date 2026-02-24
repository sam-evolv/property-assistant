/**
 * Google OAuth Flow
 *
 * GET /api/integrations/oauth/google — Initiate OAuth flow
 *   Query params: development_id (required)
 *
 * Used for Google Sheets integrations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireRole } from '@/lib/supabase-server';
import { logAudit } from '@/lib/integrations/security/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const developmentId = request.nextUrl.searchParams.get('development_id');

    if (!process.env.GOOGLE_CLIENT_ID) {
      return NextResponse.json({ error: 'Google integration not configured' }, { status: 503 });
    }

    const state = randomUUID();

    // Log state for CSRF validation on callback
    await logAudit(session.tenantId, 'oauth.google.initiated', 'user', {
      actor_id: session.id,
      state,
      development_id: developmentId,
    });

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth/google/callback`;

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', `${state}:${session.tenantId}:${developmentId || ''}`);

    return NextResponse.json({ auth_url: authUrl.toString() });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[OAuth Google] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
