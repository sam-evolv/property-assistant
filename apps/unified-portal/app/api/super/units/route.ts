import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { units, developments } from '@openhouse/db/schema';
import { eq, desc, sql, count } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireRole(['super_admin']);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const developmentId = searchParams.get('development_id') || searchParams.get('projectId') || '';
    const status = searchParams.get('status') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let conditions: any[] = [];

    if (search) {
      conditions.push(sql`(
        ${units.unit_number} ILIKE ${'%' + search + '%'} OR
        ${units.address_line_1} ILIKE ${'%' + search + '%'} OR
        ${units.purchaser_name} ILIKE ${'%' + search + '%'} OR
        ${units.purchaser_email} ILIKE ${'%' + search + '%'}
      )`);
    }

    if (developmentId) {
      conditions.push(eq(units.development_id, developmentId));
    }

    if (status === 'with_purchaser') {
      conditions.push(sql`${units.purchaser_name} IS NOT NULL AND ${units.purchaser_name} != ''`);
    } else if (status === 'no_purchaser') {
      conditions.push(sql`${units.purchaser_name} IS NULL OR ${units.purchaser_name} = ''`);
    } else if (status === 'active' || status === 'handed_over') {
      conditions.push(sql`${units.consent_at} IS NOT NULL`);
    }

    const whereClause = conditions.length > 0 
      ? sql`${sql.join(conditions, sql` AND `)}` 
      : sql`1=1`;

    const [totalCount] = await db
      .select({ count: count() })
      .from(units)
      .where(whereClause);

    const [withPurchaserCount] = await db
      .select({ count: count() })
      .from(units)
      .where(sql`${units.purchaser_name} IS NOT NULL AND ${units.purchaser_name} != ''`);

    const [handedOverCount] = await db
      .select({ count: count() })
      .from(units)
      .where(sql`${units.consent_at} IS NOT NULL`);

    const unitsData = await db
      .select({
        id: units.id,
        unit_uid: units.unit_uid,
        unit_number: units.unit_number,
        unit_code: units.unit_code,
        address_line_1: units.address_line_1,
        address_line_2: units.address_line_2,
        city: units.city,
        eircode: units.eircode,
        purchaser_name: units.purchaser_name,
        purchaser_email: units.purchaser_email,
        purchaser_phone: units.purchaser_phone,
        property_type: units.property_type,
        house_type_code: units.house_type_code,
        bedrooms: units.bedrooms,
        bathrooms: units.bathrooms,
        consent_at: units.consent_at,
        last_chat_at: units.last_chat_at,
        created_at: units.created_at,
        development_id: units.development_id,
        development_name: developments.name,
      })
      .from(units)
      .leftJoin(developments, eq(units.development_id, developments.id))
      .where(whereClause)
      .orderBy(desc(units.created_at))
      .limit(limit)
      .offset(offset);

    const allDevelopments = await db
      .select({
        id: developments.id,
        name: developments.name,
      })
      .from(developments)
      .orderBy(developments.name);

    const formattedUnits = unitsData.map(u => ({
      id: u.id,
      unit_uid: u.unit_uid,
      unit_number: u.unit_number,
      unit_code: u.unit_code,
      address: [u.address_line_1, u.address_line_2, u.city, u.eircode].filter(Boolean).join(', '),
      address_line_1: u.address_line_1,
      purchaser: u.purchaser_name ? {
        name: u.purchaser_name,
        email: u.purchaser_email,
        phone: u.purchaser_phone,
      } : null,
      purchaser_name: u.purchaser_name,
      purchaser_email: u.purchaser_email,
      propertyType: u.property_type || u.house_type_code,
      house_type_code: u.house_type_code,
      bedrooms: u.bedrooms,
      bathrooms: u.bathrooms,
      development: {
        id: u.development_id,
        name: u.development_name || 'Unknown',
      },
      project_name: u.development_name || 'Unknown',
      status: u.consent_at ? 'handed_over' : u.purchaser_name ? 'assigned' : 'available',
      timeline: {
        created: u.created_at,
        handedOver: u.consent_at,
        lastActivity: u.last_chat_at,
      },
      created_at: u.created_at,
      consent_at: u.consent_at,
      last_chat_at: u.last_chat_at,
    }));

    return NextResponse.json({
      units: formattedUnits,
      count: formattedUnits.length,
      developments: allDevelopments,
      pagination: {
        page,
        limit,
        total: Number(totalCount?.count || 0),
        totalPages: Math.ceil(Number(totalCount?.count || 0) / limit),
      },
      stats: {
        total: Number(totalCount?.count || 0),
        withPurchaser: Number(withPurchaserCount?.count || 0),
        handedOver: Number(handedOverCount?.count || 0),
        pending: Number(totalCount?.count || 0) - Number(handedOverCount?.count || 0),
      },
    });
  } catch (error: any) {
    console.error('[API] /api/super/units error:', error);
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: error.message || 'Failed to fetch units' },
      { status: 500 }
    );
  }
}
