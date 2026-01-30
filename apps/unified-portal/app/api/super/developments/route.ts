import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { developments, tenants, units, onboardingSubmissions } from '@openhouse/db/schema';
import { eq, sql, count } from 'drizzle-orm';
import { requireRole } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireRole(['super_admin']);

    const developmentsData = await db
      .select({
        id: developments.id,
        name: developments.name,
        code: developments.code,
        slug: developments.slug,
        address: developments.address,
        is_active: developments.is_active,
        created_at: developments.created_at,
        tenant_id: developments.tenant_id,
        tenant_name: tenants.name,
        system_instructions: developments.system_instructions,
      })
      .from(developments)
      .leftJoin(tenants, eq(developments.tenant_id, tenants.id))
      .orderBy(sql`${developments.created_at} DESC`);

    let unitCounts: Record<string, number> = {};

    if (developmentsData.length > 0) {
      try {
        const unitCountsResult = await db
          .select({
            development_id: units.development_id,
            count: count(),
          })
          .from(units)
          .groupBy(units.development_id);

        unitCounts = unitCountsResult.reduce((acc, row) => {
          if (row.development_id) {
            acc[row.development_id] = Number(row.count);
          }
          return acc;
        }, {} as Record<string, number>);
      } catch (unitError) {
        console.log('[Super Developments API] Units table query failed, using 0 counts');
      }
    }

    const formattedDevelopments = developmentsData.map(dev => ({
      id: dev.id,
      name: dev.name,
      code: dev.code || '',
      slug: dev.slug || '',
      address: dev.address,
      is_active: dev.is_active,
      created_at: dev.created_at,
      system_instructions: dev.system_instructions || '',
      tenant: dev.tenant_id ? {
        id: dev.tenant_id,
        name: dev.tenant_name || 'Unknown',
      } : null,
      _count: {
        units: unitCounts[dev.id] || 0,
        homeowners: 0,
      },
    }));

    return NextResponse.json({ 
      developments: formattedDevelopments,
      total: formattedDevelopments.length,
    });
  } catch (error: any) {
    console.error('[Super Developments API] Error:', error);
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch developments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['super_admin']);

    const body = await request.json();
    const { 
      name, 
      code, 
      tenant_id, 
      address, 
      description,
      sidebar_logo_url,
      assistant_logo_url,
      toolbar_logo_url,
      from_submission_id,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Development name is required' }, { status: 400 });
    }
    if (!code?.trim()) {
      return NextResponse.json({ error: 'Development code is required' }, { status: 400 });
    }
    if (!tenant_id) {
      return NextResponse.json({ error: 'Tenant is required' }, { status: 400 });
    }

    const existingCode = await db
      .select({ id: developments.id })
      .from(developments)
      .where(eq(developments.code, code.trim().toUpperCase()))
      .limit(1);

    if (existingCode.length > 0) {
      return NextResponse.json({ error: 'A development with this code already exists' }, { status: 400 });
    }

    const slug = code.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const [newDevelopment] = await db
      .insert(developments)
      .values({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        slug,
        tenant_id,
        address: address?.trim() || null,
        description: description?.trim() || null,
        logo_url: sidebar_logo_url || null,
        is_active: true,
      })
      .returning({ id: developments.id });

    if (from_submission_id) {
      await db
        .update(onboardingSubmissions)
        .set({ status: 'completed' })
        .where(eq(onboardingSubmissions.id, from_submission_id));
    }

    console.log('[Super Developments API] Created development:', newDevelopment.id);

    return NextResponse.json({ 
      success: true,
      id: newDevelopment.id,
    });
  } catch (error: any) {
    console.error('[Super Developments API] Create error:', error);
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A development with this code already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create development' }, { status: 500 });
  }
}
