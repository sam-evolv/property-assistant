/**
 * Microsoft OAuth Flow
 *
 * GET /api/integrations/oauth/microsoft — Initiate OAuth flow
 *   Query params: development_id (required)
 *
 * Used for OneDrive, SharePoint, and Dynamics 365 integrations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const developmentId = request.nextUrl.searchParams.get('development_id');
    const integrationType = request.nextUrl.searchParams.get('type') || 'excel_onedrive';

    if (!process.env.MICROSOFT_CLIENT_ID) {
      return NextResponse.json({ error: 'Microsoft integration not configured' }, { status: 503 });
    }

    // Store state for CSRF protection
    const state = randomUUID();
    const supabase = getSupabaseAdmin();

    await supabase.from('integration_audit_log').insert({
      tenant_id: session.tenantId,
      action: 'oauth.microsoft.initiated',
      actor_type: 'user',
      actor_id: session.id,
      metadata: {
        state,
        development_id: developmentId,
        integration_type: integrationType,
      },
    });

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth/microsoft/callback`;

    const scopes = integrationType.includes('dynamics')
      ? 'offline_access'
      : 'Files.ReadWrite.All Sites.ReadWrite.All offline_access';

    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    authUrl.searchParams.set('client_id', process.env.MICROSOFT_CLIENT_ID!);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', `${state}:${session.tenantId}:${developmentId || ''}:${integrationType}`);

    return NextResponse.json({ auth_url: authUrl.toString() });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[OAuth Microsoft] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
