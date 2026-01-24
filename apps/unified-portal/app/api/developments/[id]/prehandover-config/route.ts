import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/developments/:id/prehandover-config
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseClient();
    const { id } = params;

    const { data, error } = await supabase
      .from('developments')
      .select('prehandover_config')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching prehandover config:', error);
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
    console.error('Error in GET prehandover config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/developments/:id/prehandover-config
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseClient();
    const { id } = params;
    const config = await request.json();

    const { error } = await supabase
      .from('developments')
      .update({ prehandover_config: config })
      .eq('id', id);

    if (error) {
      console.error('Error updating prehandover config:', error);
      return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PUT prehandover config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
