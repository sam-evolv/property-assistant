import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateQRToken } from '@openhouse/api/qr-tokens';

const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const token = searchParams.get('token');
    
    if (!code) {
      return NextResponse.json({ error: 'Missing code parameter' }, { status: 400 });
    }

    if (!token) {
      return NextResponse.json({ error: 'Missing token parameter' }, { status: 400 });
    }

    const payload = await validateQRToken(token);
    if (!payload) {
      console.error('[HOUSES RESOLVE] Invalid or expired token');
      return NextResponse.json({ error: 'Invalid or expired QR code' }, { status: 401 });
    }

    // Verify the token's supabaseUnitId matches the requested code (UUID)
    if (payload.supabaseUnitId !== code) {
      console.error('[HOUSES RESOLVE] Token supabaseUnitId mismatch:', {
        expected: payload.supabaseUnitId,
        received: code
      });
      return NextResponse.json({ error: 'Invalid QR code for this unit' }, { status: 401 });
    }

    console.log(`[HOUSES RESOLVE] Token validated for Supabase unit: ${code}`);

    // Query by Supabase units.id (UUID)
    const { data: unit, error: unitError } = await supabasePublic
      .from('units')
      .select(`
        *,
        unit_types (*),
        projects (*)
      `)
      .eq('id', payload.supabaseUnitId)
      .single();

    if (unitError || !unit) {
      console.error('[HOUSES RESOLVE] Unit not found:', unitError);
      return NextResponse.json({ error: 'House not found' }, { status: 404 });
    }

    console.log(`[HOUSES RESOLVE] Found unit:`, {
      id: unit.id,
      unit_number: unit.unit_number,
      user_id: unit.user_id,
      unit_type: unit.unit_types?.type_name,
      project: unit.projects?.name,
    });

    const unitType = unit.unit_types;
    const project = unit.projects;

    const purchaserName = await getPurchaserName(unit.user_id);

    return NextResponse.json({
      house_id: unit.id,
      user_id: unit.user_id,
      development_id: project?.id || payload.projectId,
      development_code: project?.id || null,
      development_name: project?.name || 'Your Development',
      development_logo_url: null,
      development_system_instructions: project?.description || '',
      unit_uid: unit.id,  // Use Supabase UUID as unit_uid
      unit_number: unit.unit_number,
      address: `Unit ${unit.unit_number}`,
      eircode: null,
      house_type: unitType?.type_name || 'Standard',
      bedrooms: unitType?.bedrooms || 0,
      bathrooms: unitType?.bathrooms || 0,
      floor_area_m2: unitType?.total_area_sqm || null,
      floor_plan_pdf_url: unitType?.floor_plan_pdf_url || null,
      purchaser_name: purchaserName,
      purchaser_email: null,
      mrpn: null,
      electricity_account: null,
      esb_eirgrid_number: null,
      latitude: null,
      longitude: null,
      metadata: null,
      tenant_id: payload.projectId,
      project_id: project?.id || null,
      unit_type_id: unit.unit_type_id,
    });
  } catch (error: any) {
    console.error('[HOUSES RESOLVE] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function getPurchaserName(userId: string | null): Promise<string> {
  if (!userId) return 'Resident';

  try {
    // Try profiles table first
    const { data, error } = await supabasePublic
      .from('profiles')
      .select('full_name, first_name, last_name')
      .eq('id', userId)
      .single();

    if (error || !data) {
      // Fallback to auth user metadata
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (authUser?.user?.user_metadata?.full_name) {
        return authUser.user.user_metadata.full_name;
      }
      if (authUser?.user?.user_metadata?.name) {
        return authUser.user.user_metadata.name;
      }
      return 'Resident';
    }

    if (data.full_name) return data.full_name;
    if (data.first_name && data.last_name) return `${data.first_name} ${data.last_name}`;
    if (data.first_name) return data.first_name;
    return 'Resident';
  } catch (e) {
    console.error('[HOUSES RESOLVE] Error fetching purchaser name:', e);
    return 'Resident';
  }
}
