import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { units, developments, messages } from '@openhouse/db/schema';
import { eq, desc, sql, count, inArray } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireRole(['super_admin']);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const developmentId = searchParams.get('development_id') || '';
    const status = searchParams.get('status') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let baseCondition = sql`${units.purchaser_name} IS NOT NULL AND ${units.purchaser_name} != ''`;

    if (search) {
      baseCondition = sql`${baseCondition} AND (
        ${units.purchaser_name} ILIKE ${'%' + search + '%'} OR
        ${units.purchaser_email} ILIKE ${'%' + search + '%'} OR
        ${units.address_line_1} ILIKE ${'%' + search + '%'} OR
        ${units.unit_number} ILIKE ${'%' + search + '%'}
      )`;
    }

    if (developmentId) {
      baseCondition = sql`${baseCondition} AND ${units.development_id} = ${developmentId}`;
    }

    if (status === 'active') {
      baseCondition = sql`${baseCondition} AND ${units.consent_at} IS NOT NULL`;
    } else if (status === 'pending') {
      baseCondition = sql`${baseCondition} AND ${units.consent_at} IS NULL`;
    }

    const [totalCount] = await db
      .select({ count: count() })
      .from(units)
      .where(baseCondition);

    const homeowners = await db
      .select({
        id: units.id,
        unit_uid: units.unit_uid,
        unit_number: units.unit_number,
        purchaser_name: units.purchaser_name,
        purchaser_email: units.purchaser_email,
        purchaser_phone: units.purchaser_phone,
        address_line_1: units.address_line_1,
        address_line_2: units.address_line_2,
        city: units.city,
        eircode: units.eircode,
        property_type: units.property_type,
        house_type_code: units.house_type_code,
        bedrooms: units.bedrooms,
        consent_at: units.consent_at,
        last_chat_at: units.last_chat_at,
        created_at: units.created_at,
        development_id: units.development_id,
        development_name: developments.name,
      })
      .from(units)
      .leftJoin(developments, eq(units.development_id, developments.id))
      .where(baseCondition)
      .orderBy(desc(units.created_at))
      .limit(limit)
      .offset(offset);

    let questionCounts: Record<string, number> = {};
    try {
      const unitIds = homeowners.map(h => h.id).filter(Boolean);
      if (unitIds.length > 0) {
        const counts = await db
          .select({
            unit_id: messages.unit_id,
            count: count(),
          })
          .from(messages)
          .where(inArray(messages.unit_id, unitIds))
          .groupBy(messages.unit_id);

        questionCounts = counts.reduce((acc, c) => {
          if (c.unit_id) acc[c.unit_id] = Number(c.count);
          return acc;
        }, {} as Record<string, number>);
      }
    } catch (e) {
      console.log('[Homeowners] Question counts failed', e);
    }

    const [activeCount] = await db
      .select({ count: count() })
      .from(units)
      .where(sql`${units.purchaser_name} IS NOT NULL AND ${units.purchaser_name} != '' AND ${units.consent_at} IS NOT NULL`);

    const [pendingCount] = await db
      .select({ count: count() })
      .from(units)
      .where(sql`${units.purchaser_name} IS NOT NULL AND ${units.purchaser_name} != '' AND ${units.consent_at} IS NULL`);

    const allDevelopments = await db
      .select({
        id: developments.id,
        name: developments.name,
      })
      .from(developments)
      .orderBy(developments.name);

    const totalQuestionsSum = Object.values(questionCounts).reduce((a, b) => a + b, 0);

    const formattedHomeowners = homeowners.map(h => ({
      id: h.id,
      name: h.purchaser_name || `Unit ${h.unit_number || 'Unknown'}`,
      email: h.purchaser_email || '',
      phone: h.purchaser_phone || '',
      unit: {
        id: h.id,
        number: h.unit_number || 'N/A',
        address: [h.address_line_1, h.address_line_2, h.city, h.eircode].filter(Boolean).join(', '),
      },
      development: {
        id: h.development_id || '',
        name: h.development_name || 'Unknown',
      },
      consentDate: h.consent_at,
      lastActivity: h.last_chat_at,
      questionsCount: questionCounts[h.id] || 0,
      status: h.consent_at ? 'active' : 'pending',
    }));

    return NextResponse.json({
      homeowners: formattedHomeowners,
      developments: allDevelopments,
      count: formattedHomeowners.length,
      pagination: {
        page,
        limit,
        total: Number(totalCount?.count || 0),
        totalPages: Math.ceil(Number(totalCount?.count || 0) / limit),
      },
      stats: {
        total: Number(totalCount?.count || 0),
        active: Number(activeCount?.count || 0),
        questionsTotal: totalQuestionsSum,
      },
    });
  } catch (error: any) {
    console.error('[API] /api/super/homeowners error:', error);
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to fetch homeowners' },
      { status: 500 }
    );
  }
}
