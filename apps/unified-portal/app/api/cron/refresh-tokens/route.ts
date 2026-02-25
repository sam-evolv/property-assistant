// Token Refresh Cron Job
//
// GET /api/cron/refresh-tokens
//
// Runs daily via Vercel Cron to refresh OAuth tokens
// before they expire.
//
// vercel.json cron config:
// { "path": "/api/cron/refresh-tokens", "schedule": "0 0 * * *" }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encryptCredentials, decryptCredentials, isTokenExpiringSoon } from '@/lib/integrations/security/token-encryption';
import { logAudit } from '@/lib/integrations/security/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  // Verify cron authorization
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  let refreshed = 0;
  let failed = 0;
  let skipped = 0;

  try {
    // Find all connected integrations
    const { data: integrations } = await supabase
      .from('integrations')
      .select('*')
      .in('status', ['connected', 'syncing'])
      .not('credentials', 'is', null);

    if (!integrations?.length) {
      return NextResponse.json({ message: 'No integrations to refresh', refreshed: 0 });
    }

    for (const integration of integrations) {
      try {
        // Skip if credentials are empty or a plain object
        if (!integration.credentials || integration.credentials === '{}') {
          skipped++;
          continue;
        }

        let credentials;
        try {
          credentials = decryptCredentials(integration.tenant_id, integration.credentials);
        } catch {
          skipped++;
          continue;
        }

        if (!credentials.refresh_token) {
          skipped++;
          continue;
        }

        if (!isTokenExpiringSoon(credentials.expires_at)) {
          skipped++;
          continue;
        }

        // Refresh the token based on integration type
        let newTokens;

        if (['excel_onedrive', 'excel_sharepoint', 'dynamics_365'].includes(integration.type)) {
          newTokens = await refreshMicrosoftToken(credentials.refresh_token);
        } else if (integration.type === 'google_sheets') {
          newTokens = await refreshGoogleToken(credentials.refresh_token);
        } else if (integration.type === 'salesforce') {
          newTokens = await refreshSalesforceToken(credentials.refresh_token);
        } else if (integration.type === 'hubspot') {
          newTokens = await refreshHubSpotToken(credentials.refresh_token);
        } else {
          skipped++;
          continue;
        }

        const updatedCredentials = {
          ...credentials,
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token || credentials.refresh_token,
          expires_at: newTokens.expires_at,
        };

        await supabase
          .from('integrations')
          .update({
            credentials: encryptCredentials(integration.tenant_id, updatedCredentials),
            updated_at: new Date().toISOString(),
          })
          .eq('id', integration.id);

        await logAudit(integration.tenant_id, 'token.refreshed', 'system', {
          integration_id: integration.id,
          type: integration.type,
        });

        refreshed++;
      } catch (error: any) {
        failed++;

        await supabase
          .from('integrations')
          .update({
            status: 'error',
            last_error: 'Token refresh failed. Please reconnect.',
            last_error_at: new Date().toISOString(),
          })
          .eq('id', integration.id);

        await logAudit(integration.tenant_id, 'token.refresh_failed', 'system', {
          integration_id: integration.id,
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      message: 'Token refresh complete',
      refreshed,
      failed,
      skipped,
      total: integrations.length,
    });
  } catch (error: any) {
    console.error('[Cron] Token refresh error:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}

// --- Token Refresh Helpers ---

async function refreshMicrosoftToken(refreshToken: string) {
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || 'Microsoft token refresh failed');

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

async function refreshGoogleToken(refreshToken: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || 'Google token refresh failed');

  return {
    access_token: data.access_token,
    refresh_token: null, // Google doesn't always return new refresh token
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

async function refreshSalesforceToken(refreshToken: string) {
  const response = await fetch('https://login.salesforce.com/services/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.SALESFORCE_CLIENT_ID!,
      client_secret: process.env.SALESFORCE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || 'Salesforce token refresh failed');

  return {
    access_token: data.access_token,
    refresh_token: null,
    expires_at: new Date(Date.now() + 7200000).toISOString(), // Salesforce tokens expire in ~2 hours
  };
}

async function refreshHubSpotToken(refreshToken: string) {
  const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.HUBSPOT_CLIENT_ID!,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'HubSpot token refresh failed');

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}
