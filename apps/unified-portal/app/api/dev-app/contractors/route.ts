import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Contractors are tenant-shared, so these routes scope by the admin session's
 * tenantId (not per-development ownership). Reads/writes via the service role.
 */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('contractors')
      .select('*')
      .eq('tenant_id', session.tenantId)
      .order('name');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ contractors: data ?? [] });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body?.name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('contractors')
      .insert({
        tenant_id: session.tenantId,
        name: body.name,
        trades: Array.isArray(body.trades) ? body.trades : [],
        contact_name: body.contact_name ?? null,
        contact_email: body.contact_email ?? null,
        contact_phone: body.contact_phone ?? null,
        external_ref: body.external_ref ?? null,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ contractor: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
