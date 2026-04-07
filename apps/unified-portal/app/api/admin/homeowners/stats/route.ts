export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

interface UnitRow {
  id: string;
  purchaser_name: string | null;
  owner_name: string | null;
  purchaser_email: string | null;
  owner_email: string | null;
  house_type_code: string | null;
  house_type: string | null;
  address: string | null;
  address_line_1: string | null;
  unit_number: string | null;
  unit_code: string | null;
  lot_number: string | null;
  project_id: string | null;
  project_name: string | null;
  development_id: string | null;
  created_at: string | null;
  last_chat_at: string | null;
  consent_at: string | null;
  registered_at: string | null;
  user_id: string | null;
  important_docs_agreed_version: number | null;
  important_docs_agreed_at: string | null;
}

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

    const { data: unitsData, error: unitsError } = await supabaseAdmin
      .from('units')
      .select('id, purchaser_name, owner_name, purchaser_email, owner_email, house_type_code, house_type, address, address_line_1, unit_number, unit_code, lot_number, project_id, project_name, development_id, created_at, last_chat_at, consent_at, registered_at, user_id, important_docs_agreed_version, important_docs_agreed_at')
      .order('created_at', { ascending: false });

    if (unitsError) {
      logger.error('[Homeowners API] Units query error', unitsError);
      return NextResponse.json({ homeowners: [], error: unitsError.message });
    }

    // Fetch projects for development names
    const { data: projectsData } = await supabaseAdmin
      .from('projects')
      .select('id, name');

    const projectsMap = new Map((projectsData || []).map(p => [p.id, p.name]));

    const formattedHomeowners = (unitsData || []).map((u: UnitRow) => ({
      id: u.id,
      name: u.purchaser_name || u.owner_name || `Unit ${u.unit_number || u.unit_code || u.lot_number || 'Unknown'}`,
      email: u.purchaser_email || u.owner_email || 'Not provided',
      house_type: u.house_type_code || u.house_type,
      address: u.address || u.address_line_1 || null,
      development_name: projectsMap.get(u.project_id || '') || u.project_name || 'Unknown',
      development_id: u.project_id || u.development_id,
      created_at: u.created_at || new Date().toISOString(),
      chat_message_count: 0,
      last_active: u.last_chat_at || null,
      registered_at: u.consent_at || u.registered_at || null,
      important_docs_agreed_version: u.important_docs_agreed_version || 0,
      important_docs_agreed_at: u.important_docs_agreed_at || null,
      is_registered: !!(u.consent_at || u.registered_at || u.user_id),
    }));

    logger.info('[Homeowners API] Returning homeowners', { count: formattedHomeowners.length });
    return NextResponse.json({ homeowners: formattedHomeowners });
  } catch (error) {
    logger.error('[Homeowners API] Error', error);
    return NextResponse.json(
      { error: 'Failed to fetch homeowners', homeowners: [] },
      { status: 500 }
    );
  }
}
