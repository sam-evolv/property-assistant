export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession, requireRole } from '@/lib/supabase-server';
import { validatePurchaserToken } from '@openhouse/api/qr-tokens';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/units/:unitId/prehandover
// Returns pre-handover portal data for a unit
// SECURITY: consumed by the purchaser portal (/homes/[unitUid] via PreHandoverPortal) without
// an admin session, and by developer surfaces with one. Accept EITHER a valid admin session
// (with unit-ownership check) OR the purchaser token validation used by sibling purchaser routes.
export async function GET(
  request: NextRequest,
  { params }: { params: { unitId: string } }
) {
  try {
    const supabase = getSupabaseClient();
    const { unitId } = params;

    const session = await getServerSession();
    const isAdminSession = !!session && ['developer', 'admin', 'super_admin'].includes(session.role);

    if (!isAdminSession) {
      // Purchaser path — same validation as sibling purchaser routes (e.g. /api/purchaser/videos):
      // token bound to this unit, with unit-uid showhouse/continued-session fallback.
      const { searchParams } = new URL(request.url);
      const token = searchParams.get('token');
      const tokenResult = await validatePurchaserToken(token || unitId, unitId);
      if (!tokenResult.valid) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Fetch unit with development info
    // tenant-scope: unit fetched by id; admin sessions are tenant-checked below,
    // purchaser access is bound to this unit by validatePurchaserToken above
    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select(`
        id,
        tenant_id,
        unit_code,
        address,
        house_type,
        bedrooms,
        handover_complete,
        handover_date,
        current_milestone,
        milestone_dates,
        est_snagging_date,
        est_handover_date,
        development:developments (
          id,
          name,
          code,
          prehandover_config
        )
      `)
      .eq('id', unitId)
      .single();

    if (unitError || !unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    // SECURITY: admin sessions may only read units in their own tenant (super_admin exempt)
    if (isAdminSession && session && session.role !== 'super_admin' && unit.tenant_id !== session.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch documents for this unit
    const { data: documents } = await supabase
      .from('documents')
      .select('id, name, file_url, file_size, document_type')
      .eq('unit_id', unitId)
      .order('created_at', { ascending: false });

    // Build response
    const development = unit.development as any;
    const config = development?.prehandover_config || {};

    const response = {
      unitId: unit.id,
      propertyName: unit.address || `Unit ${unit.unit_code}`,
      propertyType: `${unit.bedrooms} Bed`,
      houseType: unit.house_type || 'House',
      handoverComplete: unit.handover_complete || false,
      currentMilestone: unit.current_milestone || 'sale_agreed',
      milestoneDates: unit.milestone_dates || {},
      estSnaggingDate: unit.est_snagging_date,
      estHandoverDate: unit.est_handover_date,
      documents: (documents || []).map((doc: any) => ({
        id: doc.id,
        name: doc.name,
        type: mapDocumentType(doc.document_type),
        url: doc.file_url,
        size: formatFileSize(doc.file_size),
      })),
      contacts: config.contacts || {
        salesPhone: '',
        salesEmail: '',
        showHouseAddress: '',
      },
      faqs: config.faqs || [],
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/units/:unitId/prehandover
// Update unit milestone or estimated dates
// SECURITY: developer-only consumer (UnitHandoverStatus) — admin session + unit ownership required
export async function PATCH(
  request: NextRequest,
  { params }: { params: { unitId: string } }
) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const supabase = getSupabaseClient();
    const { unitId } = params;

    // SECURITY: verify the unit belongs to the session tenant (super_admin exempt)
    // tenant-scope: unit fetched by id, tenant_id compared against session tenant
    const { data: unit, error: unitFetchError } = await supabase
      .from('units')
      .select('id, tenant_id')
      .eq('id', unitId)
      .single();

    if (unitFetchError || !unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    if (session.role !== 'super_admin' && unit.tenant_id !== session.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updates = await request.json();

    const allowedFields = [
      'current_milestone',
      'milestone_dates',
      'est_snagging_date',
      'est_handover_date',
      'handover_complete',
      'handover_date',
    ];

    // Filter to allowed fields
    const filteredUpdates: Record<string, any> = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { error } = await supabase
      .from('units')
      .update(filteredUpdates)
      .eq('id', unitId);

    if (error) {
      return NextResponse.json({ error: 'Failed to update unit' }, { status: 500 });
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

// Helper functions
function mapDocumentType(type: string): string {
  const typeMap: Record<string, string> = {
    floor_plan: 'floor_plan',
    contract: 'contract',
    kitchen: 'kitchen',
    kitchen_selection: 'kitchen',
  };
  return typeMap[type] || 'other';
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
