/**
 * OpenHouse Public API v1
 *
 * Base URL: https://app.openhouseai.ie/api/v1
 * Auth: Bearer token (API key)
 *
 * Endpoints:
 *   GET    /developments                    — List developments
 *   GET    /developments/:id                — Get development details
 *   GET    /developments/:id/units          — List units in development
 *   GET    /developments/:id/units/:unitId  — Get unit details
 *   GET    /developments/:id/pipeline       — Get sales pipeline
 *   PATCH  /developments/:id/units/:unitId  — Update unit fields
 *   PATCH  /developments/:id/pipeline/:unitId — Update pipeline fields
 *   GET    /developments/:id/purchasers     — List purchasers
 *   GET    /developments/:id/documents      — List compliance documents
 *   GET    /developments/:id/analytics      — Get engagement analytics
 *   POST   /webhooks                        — Register webhook
 *   GET    /webhooks                        — List webhooks
 *   DELETE /webhooks/:id                    — Remove webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withApiAuth, hasScope, hasDevelopmentAccess, ApiKeyContext } from '@/lib/integrations/api-auth';
import { logAudit } from '@/lib/integrations/security/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// --- Handler Functions ---

async function listDevelopments(ctx: ApiKeyContext): Promise<NextResponse> {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('developments')
    .select('id, name, code, address, is_active, created_at')
    .eq('tenant_id', ctx.tenant_id)
    .order('name');

  if (ctx.allowed_developments?.length) {
    query = query.in('id', ctx.allowed_developments);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ developments: data || [] });
}

async function getDevelopment(ctx: ApiKeyContext, id: string): Promise<NextResponse> {
  if (!hasDevelopmentAccess(ctx, id)) {
    return NextResponse.json({ error: 'Access denied to this development' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('developments')
    .select('id, name, code, address, description, is_active, project_type, created_at')
    .eq('id', id)
    .eq('tenant_id', ctx.tenant_id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Development not found' }, { status: 404 });

  return NextResponse.json({ development: data });
}

async function listUnits(ctx: ApiKeyContext, developmentId: string): Promise<NextResponse> {
  if (!hasDevelopmentAccess(ctx, developmentId)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('units')
    .select('id, address, development_id, house_type_code, created_at')
    .eq('development_id', developmentId)
    .order('address');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ units: data || [] });
}

async function getUnit(ctx: ApiKeyContext, developmentId: string, unitId: string): Promise<NextResponse> {
  if (!hasDevelopmentAccess(ctx, developmentId)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('units')
    .select('*')
    .eq('id', unitId)
    .eq('development_id', developmentId)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });

  return NextResponse.json({ unit: data });
}

async function getPipeline(ctx: ApiKeyContext, developmentId: string): Promise<NextResponse> {
  if (!hasDevelopmentAccess(ctx, developmentId)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('unit_sales_pipeline')
    .select('*')
    .eq('development_id', developmentId)
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ pipeline: data || [] });
}

async function listPurchasers(ctx: ApiKeyContext, developmentId: string): Promise<NextResponse> {
  if (!hasDevelopmentAccess(ctx, developmentId)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('unit_sales_pipeline')
    .select('unit_id, purchaser_name, purchaser_email, purchaser_phone, status')
    .eq('development_id', developmentId)
    .not('purchaser_name', 'is', null)
    .order('purchaser_name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ purchasers: data || [] });
}

async function listDocuments(ctx: ApiKeyContext, developmentId: string): Promise<NextResponse> {
  if (!hasDevelopmentAccess(ctx, developmentId)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('documents')
    .select('id, title, document_type, file_name, created_at, status')
    .eq('development_id', developmentId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ documents: data || [] });
}

async function getAnalytics(ctx: ApiKeyContext, developmentId: string): Promise<NextResponse> {
  if (!hasDevelopmentAccess(ctx, developmentId)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  // Get basic analytics
  const [unitsResult, messagesResult, docsResult] = await Promise.all([
    supabase.from('units').select('*', { count: 'exact', head: true }).eq('development_id', developmentId),
    supabase.from('messages').select('*', { count: 'exact', head: true }).eq('development_id', developmentId),
    supabase.from('documents').select('*', { count: 'exact', head: true }).eq('development_id', developmentId).eq('status', 'active'),
  ]);

  return NextResponse.json({
    analytics: {
      total_units: unitsResult.count || 0,
      total_messages: messagesResult.count || 0,
      total_documents: docsResult.count || 0,
    },
  });
}

async function listWebhooks(ctx: ApiKeyContext): Promise<NextResponse> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('webhooks')
    .select('id, url, events, development_ids, is_active, consecutive_failures, last_triggered_at, created_at')
    .eq('tenant_id', ctx.tenant_id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ webhooks: data || [] });
}

// --- Route Handlers ---

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return withApiAuth(request, async (ctx) => {
    if (!hasScope(ctx, 'read')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const pathSegments = params.path;
    const [resource, id, subResource, subId] = pathSegments;

    switch (resource) {
      case 'developments':
        if (!id) return listDevelopments(ctx);
        if (!subResource) return getDevelopment(ctx, id);
        if (subResource === 'units' && !subId) return listUnits(ctx, id);
        if (subResource === 'units' && subId) return getUnit(ctx, id, subId);
        if (subResource === 'pipeline') return getPipeline(ctx, id);
        if (subResource === 'purchasers') return listPurchasers(ctx, id);
        if (subResource === 'documents') return listDocuments(ctx, id);
        if (subResource === 'analytics') return getAnalytics(ctx, id);
        break;
      case 'webhooks':
        if (!id) return listWebhooks(ctx);
        break;
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }, 'read');
}

export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } }) {
  return withApiAuth(request, async (ctx) => {
    if (!hasScope(ctx, 'write')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const pathSegments = params.path;
    const [resource, id, subResource, subId] = pathSegments;

    if (resource !== 'developments' || !id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (!hasDevelopmentAccess(ctx, id)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const supabase = getSupabaseAdmin();

    if (subResource === 'units' && subId) {
      // Update unit fields
      const { data, error } = await supabase
        .from('units')
        .update(body)
        .eq('id', subId)
        .eq('development_id', id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });

      await logAudit(ctx.tenant_id, 'api.unit_updated', 'api_key', {
        key_prefix: ctx.key_prefix,
        development_id: id,
        unit_id: subId,
        fields: Object.keys(body),
      });

      return NextResponse.json({ unit: data });
    }

    if (subResource === 'pipeline' && subId) {
      // Update pipeline fields
      const { data, error } = await supabase
        .from('unit_sales_pipeline')
        .update(body)
        .eq('unit_id', subId)
        .eq('development_id', id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data) return NextResponse.json({ error: 'Pipeline record not found' }, { status: 404 });

      await logAudit(ctx.tenant_id, 'api.pipeline_updated', 'api_key', {
        key_prefix: ctx.key_prefix,
        development_id: id,
        unit_id: subId,
        fields: Object.keys(body),
      });

      return NextResponse.json({ pipeline: data });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }, 'write');
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return withApiAuth(request, async (ctx) => {
    const pathSegments = params.path;
    const [resource] = pathSegments;

    if (resource === 'webhooks') {
      if (!hasScope(ctx, 'write')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }

      const { url, events, development_ids } = await request.json();

      if (!url || !events?.length) {
        return NextResponse.json({ error: 'url and events are required' }, { status: 400 });
      }

      const supabase = getSupabaseAdmin();
      const { randomBytes } = await import('crypto');
      const secret = randomBytes(32).toString('hex');

      const { data, error } = await supabase
        .from('webhooks')
        .insert({
          tenant_id: ctx.tenant_id,
          url,
          secret,
          events,
          development_ids: development_ids || null,
        })
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await logAudit(ctx.tenant_id, 'webhook.created', 'api_key', {
        key_prefix: ctx.key_prefix,
        webhook_id: data.id,
        url,
        events,
      });

      return NextResponse.json({
        webhook: { ...data, secret },
        message: 'Save the webhook secret securely for signature verification.',
      }, { status: 201 });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }, 'write');
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return withApiAuth(request, async (ctx) => {
    if (!hasScope(ctx, 'write')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const pathSegments = params.path;
    const [resource, id] = pathSegments;

    if (resource === 'webhooks' && id) {
      const supabase = getSupabaseAdmin();

      const { data } = await supabase
        .from('webhooks')
        .select('id')
        .eq('id', id)
        .eq('tenant_id', ctx.tenant_id)
        .single();

      if (!data) return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });

      await supabase.from('webhooks').delete().eq('id', id);

      await logAudit(ctx.tenant_id, 'webhook.deleted', 'api_key', {
        key_prefix: ctx.key_prefix,
        webhook_id: id,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }, 'write');
}
