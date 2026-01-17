export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    // Fetch all tenants - use SELECT * to get all available columns
    const { data: allTenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: true });

    if (tenantsError) {
      console.error('Error fetching tenants:', tenantsError);
      throw tenantsError;
    }

    // Fetch development counts per tenant
    const { data: devCounts, error: devsError } = await supabase
      .from('developments')
      .select('tenant_id');

    if (devsError) {
      console.error('Error fetching developments:', devsError);
      // Continue without counts rather than failing
    }

    // Build a lookup map for counts
    const countMap: Record<string, number> = {};
    if (devCounts) {
      devCounts.forEach(row => {
        countMap[row.tenant_id] = (countMap[row.tenant_id] || 0) + 1;
      });
    }

    // Combine results
    const result = (allTenants || []).map(t => ({
      ...t,
      house_count: countMap[t.id] || 0,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tenants' },
      { status: 500 }
    );
  }
}
