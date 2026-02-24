/**
 * API Key Management
 *
 * POST /api/integrations/api-keys — Generate a new API key
 * GET  /api/integrations/api-keys — List API keys (prefix only)
 * DELETE /api/integrations/api-keys?id=xxx — Revoke an API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { randomBytes } from 'crypto';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { logAudit } from '@/lib/integrations/security/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const { name, scopes, allowed_developments, rate_limit_per_minute, expires_at } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const validScopes = ['read', 'write', 'admin'];
    const requestedScopes = (scopes || ['read']).filter((s: string) => validScopes.includes(s));

    // Generate API key: oh_live_ + 32 random bytes as hex
    const rawKey = `oh_live_${randomBytes(32).toString('hex')}`;
    const keyPrefix = rawKey.slice(0, 16);
    const keyHash = await hash(rawKey, 12);

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        tenant_id: tenantId,
        name,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        scopes: requestedScopes,
        allowed_developments: allowed_developments || null,
        rate_limit_per_minute: rate_limit_per_minute || 60,
        expires_at: expires_at || null,
      })
      .select('id, name, key_prefix, scopes, allowed_developments, rate_limit_per_minute, expires_at, created_at')
      .single();

    if (error) {
      console.error('[API Keys] Create error:', error);
      return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
    }

    await logAudit(tenantId, 'api_key.created', 'user', {
      actor_id: session.id,
      resource_type: 'api_key',
      resource_id: data.id,
      key_prefix: keyPrefix,
      scopes: requestedScopes,
    }, request);

    // Return the raw key ONCE. It cannot be retrieved again.
    return NextResponse.json({
      ...data,
      key: rawKey,
      message: 'Save this key securely. It will not be shown again.',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('[API Keys] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, scopes, allowed_developments, rate_limit_per_minute, is_active, last_used_at, expires_at, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[API Keys] List error:', error);
      return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
    }

    return NextResponse.json({ api_keys: data || [] });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API Keys] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const keyId = request.nextUrl.searchParams.get('id');
    if (!keyId) {
      return NextResponse.json({ error: 'API key ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Verify ownership
    const { data: existing } = await supabase
      .from('api_keys')
      .select('id, key_prefix')
      .eq('id', keyId)
      .eq('tenant_id', tenantId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    // Soft-delete (deactivate)
    await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', keyId);

    await logAudit(tenantId, 'api_key.revoked', 'user', {
      actor_id: session.id,
      resource_type: 'api_key',
      resource_id: keyId,
      key_prefix: existing.key_prefix,
    }, request);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API Keys] Delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
