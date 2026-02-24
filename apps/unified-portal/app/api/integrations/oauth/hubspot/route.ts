/**
 * HubSpot OAuth Flow
 *
 * GET /api/integrations/oauth/hubspot — Initiate OAuth flow
 *   Query params: development_id (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireRole } from '@/lib/supabase-server';
import { logAudit } from '@/lib/integrations/security/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HUBSPOT_SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.deals.read',
  'crm.objects.deals.write',
  'crm.objects.companies.read',
  'crm.objects.companies.write',
].join(' ');

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const developmentId = request.nextUrl.searchParams.get('development_id');

    if (!process.env.HUBSPOT_CLIENT_ID) {
      return NextResponse.json({ error: 'HubSpot integration not configured' }, { status: 503 });
    }

    const state = randomUUID();

    await logAudit(session.tenantId, 'oauth.hubspot.initiated', 'user', {
      actor_id: session.id,
      state,
      development_id: developmentId,
    });

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth/hubspot/callback`;

    const authUrl = new URL('https://app.hubspot.com/oauth/authorize');
    authUrl.searchParams.set('client_id', process.env.HUBSPOT_CLIENT_ID!);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', HUBSPOT_SCOPES);
    authUrl.searchParams.set('state', `${state}:${session.tenantId}:${developmentId || ''}`);

    return NextResponse.json({ auth_url: authUrl.toString() });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[OAuth HubSpot] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
