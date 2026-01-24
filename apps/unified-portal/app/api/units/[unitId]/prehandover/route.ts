import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/units/:unitId/prehandover
// Returns pre-handover portal data for a unit
export async function GET(
  request: NextRequest,
  { params }: { params: { unitId: string } }
) {
  try {
    const supabase = getSupabaseClient();
    const { unitId } = params;

    // Fetch unit with development info
    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select(`
        id,
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
    console.error('Error fetching unit prehandover data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/units/:unitId/prehandover
// Update unit milestone or estimated dates
export async function PATCH(
  request: NextRequest,
  { params }: { params: { unitId: string } }
) {
  try {
    const supabase = getSupabaseClient();
    const { unitId } = params;
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
      console.error('Error updating unit:', error);
      return NextResponse.json({ error: 'Failed to update unit' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PATCH unit prehandover:', error);
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
