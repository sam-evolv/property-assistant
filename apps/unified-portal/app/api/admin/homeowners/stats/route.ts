export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    
    // Fetch units from Supabase (where units data lives)
    const { data: unitsData, error: unitsError } = await supabaseAdmin
      .from('units')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (unitsError) {
      console.error('[Homeowners API] Units query error:', unitsError);
      return NextResponse.json({ homeowners: [], error: unitsError.message });
    }
    
    // Fetch projects for development names
    const { data: projectsData } = await supabaseAdmin
      .from('projects')
      .select('id, name');
    
    const projectsMap = new Map((projectsData || []).map(p => [p.id, p.name]));

    const formattedHomeowners = (unitsData || []).map((u: any) => ({
      id: u.id,
      name: u.purchaser_name || u.owner_name || `Unit ${u.unit_number || u.unit_code || u.lot_number || 'Unknown'}`,
      email: u.purchaser_email || u.owner_email || 'Not provided',
      house_type: u.house_type_code || u.house_type,
      address: u.address || u.address_line_1 || null,
      development_name: projectsMap.get(u.project_id) || u.project_name || 'Unknown',
      development_id: u.project_id || u.development_id,
      created_at: u.created_at || new Date().toISOString(),
      chat_message_count: 0,
      last_active: u.last_chat_at || null,
      registered_at: u.consent_at || u.registered_at || null,
      important_docs_agreed_version: u.important_docs_agreed_version || 0,
      important_docs_agreed_at: u.important_docs_agreed_at || null,
      is_registered: !!(u.consent_at || u.registered_at || u.user_id),
    }));

    console.log(`[Homeowners API] Returning ${formattedHomeowners.length} homeowners from Supabase`);
    return NextResponse.json({ homeowners: formattedHomeowners });
  } catch (error) {
    console.error('[API] /api/admin/homeowners/stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch homeowners', homeowners: [] },
      { status: 500 }
    );
  }
}
