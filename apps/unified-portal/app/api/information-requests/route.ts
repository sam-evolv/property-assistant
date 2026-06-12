export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase-server';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      db: { schema: 'public' }
    }
  );
}

// Helper to resolve tenant/development from unit
async function resolveUnitContext(unitId: string | null): Promise<{ tenantId: string | null; developmentId: string | null }> {
  if (!unitId) return { tenantId: null, developmentId: null };

  try {
    const supabase = getSupabaseAdmin();

    // Try by ID first
    let { data: unit, error } = await supabase
      .from('units')
      .select('tenant_id, project_id')
      .eq('id', unitId)
      .single();

    // If not found by ID, try by unit_uid
    if (error || !unit) {
      const { data: unitByUid } = await supabase
        .from('units')
        .select('tenant_id, project_id')
        .eq('unit_uid', unitId)
        .single();
      unit = unitByUid;
    }

    if (unit) {
      return { tenantId: unit.tenant_id, developmentId: unit.project_id };
    }
  } catch (_e) {
      // error handled silently
  }
  return { tenantId: null, developmentId: null };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, context, unitId, topic } = body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    // Resolve tenant/development from unit - MUST succeed for proper isolation
    const unitContext = await resolveUnitContext(unitId);

    if (!unitContext.tenantId || !unitContext.developmentId) {
      return NextResponse.json(
        { error: 'Could not resolve unit context. Please try again or contact support.' },
        { status: 422 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: newRequest, error: insertError } = await supabase
      .from('information_requests')
      .insert({
        tenant_id: unitContext.tenantId,
        development_id: unitContext.developmentId,
        unit_id: unitId || null,
        question: question.trim(),
        context: context || null,
        topic: topic || null,
        status: 'pending',
        priority: 'normal',
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to submit request' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      id: newRequest?.id,
      message: 'Your question has been submitted. The developer team will review it and add this information to help future residents.',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to submit request' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const developmentId = searchParams.get('developmentId');
    const requestedTenantId = searchParams.get('tenantId');
    const limit = parseInt(searchParams.get('limit') || '50');

    // SECURITY: ignore the client-supplied tenantId — always scope to the session
    // tenant. Only super_admin may query another tenant via the param.
    const tenantId = session.role === 'super_admin'
      ? (requestedTenantId || null)
      : session.tenantId;

    const supabase = getSupabaseAdmin();

    // Build query
    // tenant-scope: scoped to session.tenantId for non-super sessions above
    let query = supabase
      .from('information_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    if (developmentId) {
      query = query.eq('development_id', developmentId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data: requests, error } = await query;

    if (error) {
      // Table might not exist - return empty list gracefully
      return NextResponse.json({
        success: true,
        requests: [],
        total: 0,
      });
    }

    return NextResponse.json({
      success: true,
      requests: requests || [],
      total: requests?.length || 0,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (errorMessage === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    );
  }
}
