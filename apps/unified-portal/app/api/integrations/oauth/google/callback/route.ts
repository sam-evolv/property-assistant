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

    // Parse state: uuid:tenantId:developmentId
    const [, tenantId, developmentId] = state.split(':');

    if (!tenantId) {
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
      console.error('[OAuth Google Callback] Token exchange failed:', tokens);
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
      console.error('[OAuth Google Callback] Insert error:', insertError);
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
    console.error('[OAuth Google Callback] Error:', err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/developer/integrations?error=unexpected`
    );
  }
}
