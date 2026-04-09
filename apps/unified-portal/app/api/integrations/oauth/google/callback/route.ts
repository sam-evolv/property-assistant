/**
 * Google OAuth Callback
 *
 * GET /api/integrations/oauth/google/callback
 *
 * Exchanges auth code for tokens, encrypts them, creates integration record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encryptCredentials } from '@/lib/integrations/security/token-encryption';
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
  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/developer/integrations?error=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/developer/integrations?error=missing_params`
      );
    }

    // Parse state: uuid:tenantId:developmentId or uuid:tenantId:developmentId:type
    const stateParts = state.split(':');
    const [stateUuid, tenantId, developmentId] = stateParts;
    const stateType = stateParts[3] || '';

    if (!tenantId || !stateUuid) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/developer/integrations?error=invalid_state`
      );
    }

    // Verify the state UUID was issued by us (CSRF protection)
    const supabaseCheck = getSupabaseAdmin();
    const { data: stateRecord } = await supabaseCheck
      .from('integration_audit_log')
      .select('id')
      .eq('action', 'oauth.google.initiated')
      .eq('tenant_id', tenantId)
      .contains('metadata', { state: stateUuid })
      .limit(1)
      .single();

    if (!stateRecord) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/developer/integrations?error=invalid_state`
      );
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok || !tokens.access_token) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/developer/integrations?error=token_exchange_failed`
      );
    }

    // Encrypt and store credentials
    const credentials = encryptCredentials(tenantId, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      token_type: tokens.token_type,
      scope: tokens.scope,
    });

    const supabase = getSupabaseAdmin();

    // Cloud storage flow: create storage_connections instead of integrations
    if (stateType === 'cloud_storage') {
      const { data: storageConn, error: storageError } = await supabase
        .from('storage_connections')
        .insert({
          tenant_id: tenantId,
          provider: 'google_drive',
          display_name: 'Google Drive',
          status: 'connected',
          credentials,
        })
        .select()
        .single();

      if (storageError) {
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL}/developer/data-hub?error=save_failed`
        );
      }

      await logAudit(tenantId, 'integration.created', 'user', {
        resource_type: 'storage_connection',
        resource_id: storageConn.id,
        type: 'google_drive',
        provider: 'google',
      });

      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/developer/data-hub?connected=${storageConn.id}`
      );
    }

    const { data: integration, error: insertError } = await supabase
      .from('integrations')
      .insert({
        tenant_id: tenantId,
        development_id: developmentId || null,
        type: 'google_sheets',
        name: 'Google Sheets Connection',
        status: 'connected',
        credentials,
        sync_direction: 'bidirectional',
        sync_frequency: 'realtime',
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/developer/integrations?error=save_failed`
      );
    }

    await logAudit(tenantId, 'integration.created', 'user', {
      resource_type: 'integration',
      resource_id: integration.id,
      type: 'google_sheets',
      provider: 'google',
    });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/developer/integrations?connected=${integration.id}`
    );
  } catch (err: any) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/developer/integrations?error=unexpected`
    );
  }
}
