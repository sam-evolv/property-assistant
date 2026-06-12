export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole, type AdminSession } from '@/lib/supabase-server';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// SECURITY: verify the development belongs to the session tenant (super_admin exempt)
async function assertDevelopmentOwnership(
  supabase: ReturnType<typeof getSupabaseClient>,
  session: AdminSession,
  developmentId: string
): Promise<NextResponse | null> {
  // tenant-scope: development fetched by id, then tenant_id compared against session tenant below
  const { data: development, error } = await supabase
    .from('developments')
    .select('id, tenant_id')
    .eq('id', developmentId)
    .single();

  if (error || !development) {
    return NextResponse.json({ error: 'Development not found' }, { status: 404 });
  }

  if (session.role !== 'super_admin' && development.tenant_id !== session.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return null;
}

// GET /api/developments/:id/prehandover-config
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // SECURITY: only developer pages consume this endpoint — require an admin session
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const supabase = getSupabaseClient();
    const { id } = params;

    const ownershipError = await assertDevelopmentOwnership(supabase, session, id);
    if (ownershipError) return ownershipError;

    const { data, error } = await supabase
      .from('developments')
      .select('prehandover_config')
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
    }

    // Return config or default
    const defaultConfig = {
      milestones: [
        { id: 'sale_agreed', label: 'Sale Agreed', enabled: true },
        { id: 'contracts_signed', label: 'Contracts Signed', enabled: true },
        { id: 'kitchen_selection', label: 'Kitchen Selection', enabled: true },
        { id: 'snagging', label: 'Snagging', enabled: true },
        { id: 'closing', label: 'Closing', enabled: true },
        { id: 'handover', label: 'Handover', enabled: true },
      ],
      faqs: [],
      contacts: {
        salesPhone: '',
        salesEmail: '',
        showHouseAddress: '',
      },
      documents: {
        showFloorPlans: true,
        showContract: true,
        showKitchenSelections: true,
      },
    };

    return NextResponse.json(data?.prehandover_config || defaultConfig);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (errorMessage === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/developments/:id/prehandover-config
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const supabase = getSupabaseClient();
    const { id } = params;

    const ownershipError = await assertDevelopmentOwnership(supabase, session, id);
    if (ownershipError) return ownershipError;

    const config = await request.json();

    const { error } = await supabase
      .from('developments')
      .update({ prehandover_config: config })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (errorMessage === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
