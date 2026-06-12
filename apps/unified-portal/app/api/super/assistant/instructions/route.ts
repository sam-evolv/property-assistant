export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase-server';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase environment: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return createClient(url, key);
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireRole(['super_admin', 'admin']);
    const supabaseAdmin = getSupabaseAdmin();

    const body = await request.json();
    const { development_id, system_instructions } = body;

    if (!development_id) {
      return NextResponse.json({ error: 'development_id is required' }, { status: 400 });
    }

    // SECURITY: admins may only update developments in their own tenant (super_admin cross-tenant)
    // tenant-scope: development fetched by id, tenant_id compared against session tenant
    if (session.role !== 'super_admin') {
      const { data: development, error: devError } = await supabaseAdmin
        .from('developments')
        .select('id, tenant_id')
        .eq('id', development_id)
        .single();

      if (devError || !development) {
        return NextResponse.json({ error: 'Development not found' }, { status: 404 });
      }

      if (development.tenant_id !== session.tenantId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { error } = await supabaseAdmin
      .from('developments')
      .update({ 
        system_instructions: system_instructions?.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', development_id);

    if (error) {
      return NextResponse.json({ error: 'Failed to update system instructions' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : 'Unknown error';
    if (errMessage === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (errMessage === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
