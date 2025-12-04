import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { units, developments } from '@openhouse/db/schema';
import { eq, sql, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const unitsData = await db
      .select({
        id: units.id,
        unit_number: units.unit_number,
        unit_code: units.unit_code,
        purchaser_name: units.purchaser_name,
        purchaser_email: units.purchaser_email,
        house_type_code: units.house_type_code,
        address_line_1: units.address_line_1,
        eircode: units.eircode,
        development_name: developments.name,
        development_id: units.development_id,
        consent_at: units.consent_at,
        last_chat_at: units.last_chat_at,
        important_docs_agreed_version: units.important_docs_agreed_version,
        important_docs_agreed_at: units.important_docs_agreed_at,
        created_at: units.created_at,
      })
      .from(units)
      .leftJoin(developments, eq(units.development_id, developments.id))
      .orderBy(desc(units.created_at));

    const formattedHomeowners = unitsData.map(u => ({
      id: u.id,
      name: u.purchaser_name || `Unit ${u.unit_number || u.unit_code || 'Unknown'}`,
      email: u.purchaser_email || 'Not provided',
      house_type: u.house_type_code,
      address: u.address_line_1 ? `${u.address_line_1}${u.eircode ? ', ' + u.eircode : ''}` : null,
      development_name: u.development_name || 'Unknown',
      development_id: u.development_id,
      created_at: u.created_at?.toISOString() || new Date().toISOString(),
      chat_message_count: 0,
      last_active: u.last_chat_at?.toISOString() || null,
      registered_at: u.consent_at?.toISOString() || null,
      important_docs_agreed_version: u.important_docs_agreed_version || 0,
      important_docs_agreed_at: u.important_docs_agreed_at?.toISOString() || null,
      is_registered: !!u.consent_at,
    }));

    return NextResponse.json({ homeowners: formattedHomeowners });
  } catch (error) {
    console.error('[API] /api/admin/homeowners/stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch homeowners' },
      { status: 500 }
    );
  }
}
