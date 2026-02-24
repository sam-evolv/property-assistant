/**
 * Salesforce OAuth Callback
 *
 * GET /api/integrations/oauth/salesforce/callback
 *
 * Exchanges auth code for tokens, encrypts them, creates integration record.
 * Note: Salesforce returns instance_url which we store in credentials.
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
      const errorDescription = request.nextUrl.searchParams.get('error_description');
      console.error('[OAuth Salesforce Callback] Error:', error, errorDescription);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/developer/integrations?error=${encodeURIComponent(errorDescription || error)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/developer/integrations?error=missing_params`
      );
    }

    const [stateUuid, tenantId, developmentId] = state.split(':');

    if (!tenantId || !stateUuid) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/developer/integrations?error=invalid_state`
      );
    }

    // Verify CSRF state
    const supabase = getSupabaseAdmin();
    const { data: stateRecord } = await supabase
      .from('integration_audit_log')
      .select('id')
      .eq('action', 'oauth.salesforce.initiated')
      .eq('tenant_id', tenantId)
      .contains('metadata', { state: stateUuid })
      .limit(1)
      .single();

    if (!stateRecord) {
      console.error('[OAuth Salesforce Callback] State validation failed — possible CSRF');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/developer/integrations?error=invalid_state`
      );
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://login.salesforce.com/services/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.SALESFORCE_CLIENT_ID!,
        client_secret: process.env.SALESFORCE_CLIENT_SECRET!,
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth/salesforce/callback`,
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok || !tokens.access_token) {
      console.error('[OAuth Salesforce Callback] Token exchange failed:', tokens);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/developer/integrations?error=token_exchange_failed`
      );
    }

    // Encrypt and store credentials (include instance_url)
    const credentials = encryptCredentials(tenantId, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      instance_url: tokens.instance_url,
      expires_at: new Date(Date.now() + 7200000).toISOString(), // ~2 hours
      token_type: tokens.token_type,
    });

    const { data: integration, error: insertError } = await supabase
      .from('integrations')
      .insert({
        tenant_id: tenantId,
        development_id: developmentId || null,
        type: 'salesforce',
        name: 'Salesforce CRM Connection',
        status: 'connected',
        credentials,
        sync_direction: 'bidirectional',
        sync_frequency: 'hourly',
        external_ref: tokens.instance_url,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[OAuth Salesforce Callback] Insert error:', insertError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/developer/integrations?error=save_failed`
      );
    }

    await logAudit(tenantId, 'integration.created', 'user', {
      resource_type: 'integration',
      resource_id: integration.id,
      type: 'salesforce',
      provider: 'salesforce',
    });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/developer/integrations?connected=${integration.id}`
    );
  } catch (err: any) {
    console.error('[OAuth Salesforce Callback] Error:', err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/developer/integrations?error=unexpected`
    );
  }
}
