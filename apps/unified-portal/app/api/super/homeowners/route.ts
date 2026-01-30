import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { developments } from '@openhouse/db/schema';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireRole(['super_admin']);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const developmentId = searchParams.get('development_id') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let countQuery;
    let unitsQuery;

    if (search && developmentId) {
      const searchPattern = `%${search}%`;
      countQuery = sql`
        SELECT COUNT(*) as count FROM units u 
        WHERE (u.unit_number ILIKE ${searchPattern} OR u.address_line_1 ILIKE ${searchPattern} OR u.unit_code ILIKE ${searchPattern})
        AND u.development_id = ${developmentId}
      `;
      unitsQuery = sql`
        SELECT 
          u.id, u.unit_uid, u.unit_number, u.unit_code, u.address_line_1, u.address_line_2,
          u.city, u.eircode, u.property_type, u.house_type_code, u.bedrooms,
          u.created_at, u.development_id, d.name as development_name
        FROM units u
        LEFT JOIN developments d ON u.development_id = d.id
        WHERE (u.unit_number ILIKE ${searchPattern} OR u.address_line_1 ILIKE ${searchPattern} OR u.unit_code ILIKE ${searchPattern})
        AND u.development_id = ${developmentId}
        ORDER BY u.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (search) {
      const searchPattern = `%${search}%`;
      countQuery = sql`
        SELECT COUNT(*) as count FROM units u 
        WHERE u.unit_number ILIKE ${searchPattern} OR u.address_line_1 ILIKE ${searchPattern} OR u.unit_code ILIKE ${searchPattern}
      `;
      unitsQuery = sql`
        SELECT 
          u.id, u.unit_uid, u.unit_number, u.unit_code, u.address_line_1, u.address_line_2,
          u.city, u.eircode, u.property_type, u.house_type_code, u.bedrooms,
          u.created_at, u.development_id, d.name as development_name
        FROM units u
        LEFT JOIN developments d ON u.development_id = d.id
        WHERE u.unit_number ILIKE ${searchPattern} OR u.address_line_1 ILIKE ${searchPattern} OR u.unit_code ILIKE ${searchPattern}
        ORDER BY u.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (developmentId) {
      countQuery = sql`SELECT COUNT(*) as count FROM units u WHERE u.development_id = ${developmentId}`;
      unitsQuery = sql`
        SELECT 
          u.id, u.unit_uid, u.unit_number, u.unit_code, u.address_line_1, u.address_line_2,
          u.city, u.eircode, u.property_type, u.house_type_code, u.bedrooms,
          u.created_at, u.development_id, d.name as development_name
        FROM units u
        LEFT JOIN developments d ON u.development_id = d.id
        WHERE u.development_id = ${developmentId}
        ORDER BY u.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      countQuery = sql`SELECT COUNT(*) as count FROM units`;
      unitsQuery = sql`
        SELECT 
          u.id, u.unit_uid, u.unit_number, u.unit_code, u.address_line_1, u.address_line_2,
          u.city, u.eircode, u.property_type, u.house_type_code, u.bedrooms,
          u.created_at, u.development_id, d.name as development_name
        FROM units u
        LEFT JOIN developments d ON u.development_id = d.id
        ORDER BY u.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    const countResult = await db.execute(countQuery);
    const totalCount = Number((countResult.rows[0] as any)?.count || 0);

    const unitsResult = await db.execute(unitsQuery);

    const allDevelopments = await db
      .select({
        id: developments.id,
        name: developments.name,
      })
      .from(developments)
      .orderBy(developments.name);

    const formattedHomeowners = (unitsResult.rows as any[]).map(u => ({
      id: u.id,
      name: `Unit ${u.unit_number || u.unit_code || 'Unknown'}`,
      email: '',
      phone: '',
      unit: {
        id: u.id,
        number: u.unit_number || 'N/A',
        address: [u.address_line_1, u.address_line_2, u.city, u.eircode].filter(Boolean).join(', '),
      },
      development: {
        id: u.development_id || '',
        name: u.development_name || 'Unknown',
      },
      consentDate: null,
      lastActivity: null,
      questionsCount: 0,
      status: 'pending',
    }));

    return NextResponse.json({
      homeowners: formattedHomeowners,
      developments: allDevelopments,
      count: formattedHomeowners.length,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats: {
        total: totalCount,
        active: 0,
        questionsTotal: 0,
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
