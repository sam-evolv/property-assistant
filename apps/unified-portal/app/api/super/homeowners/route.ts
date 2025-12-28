import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { units, developments, homeowners as homeownersTable, messages } from '@openhouse/db/schema';
import { eq, asc, sql, count } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireRole(['super_admin', 'admin']);

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    console.log('[API] /api/super/homeowners - projectId:', projectId || 'all');

    let query = db
      .select({
        id: units.id,
        unit_number: units.unit_number,
        address_line_1: units.address_line_1,
        house_type_code: units.house_type_code,
        purchaser_name: units.purchaser_name,
        purchaser_email: units.purchaser_email,
        development_id: units.development_id,
        created_at: units.created_at,
        last_chat_at: units.last_chat_at,
        consent_at: units.consent_at,
        development_name: developments.name,
      })
      .from(units)
      .leftJoin(developments, eq(units.development_id, developments.id))
      .orderBy(asc(developments.name), asc(units.address_line_1));

    const unitsData = projectId
      ? await query.where(eq(units.development_id, projectId))
      : await query;

    const homeowners = unitsData.map((unit) => ({
      id: unit.id,
      name: unit.purchaser_name || `Unit ${unit.unit_number || unit.address_line_1 || 'Unknown'}`,
      email: unit.purchaser_email || 'Not collected',
      house_type: unit.house_type_code || null,
      address: unit.address_line_1 || null,
      development_name: unit.development_name || 'Unknown',
      development_id: unit.development_id,
      created_at: unit.created_at,
      chat_message_count: unit.last_chat_at ? 1 : 0,
      last_active: unit.last_chat_at,
      handover_date: null,
      is_registered: !!unit.consent_at || !!unit.purchaser_email,
      has_purchaser: !!unit.purchaser_name,
    }));

    console.log('[API] /api/super/homeowners - returned:', homeowners.length, 'homeowners for projectId:', projectId || 'all');

    return NextResponse.json({ 
      homeowners,
      count: homeowners.length,
      projectId: projectId || null,
    });
  } catch (error: any) {
    console.error('[API] /api/super/homeowners error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch homeowners' },
      { status: 500 }
    );
  }
}
