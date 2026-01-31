import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { developments, tenants, units, admins, documents } from '@openhouse/db/schema';
import { eq, sql, count, and } from 'drizzle-orm';
import { requireRole } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['super_admin', 'admin']);

    const developmentId = params.id;

    const [developmentData] = await db
      .select({
        id: developments.id,
        name: developments.name,
        code: developments.code,
        slug: developments.slug,
        address: developments.address,
        description: developments.description,
        is_active: developments.is_active,
        created_at: developments.created_at,
        tenant_id: developments.tenant_id,
        tenant_name: tenants.name,
        developer_user_id: developments.developer_user_id,
        system_instructions: developments.system_instructions,
        logo_url: developments.logo_url,
        sidebar_logo_url: developments.sidebar_logo_url,
        assistant_logo_url: developments.assistant_logo_url,
        toolbar_logo_url: developments.toolbar_logo_url,
      })
      .from(developments)
      .leftJoin(tenants, eq(developments.tenant_id, tenants.id))
      .where(eq(developments.id, developmentId))
      .limit(1);

    if (!developmentData) {
      return NextResponse.json({ error: 'Development not found' }, { status: 404 });
    }

    let unitCount = 0;
    let documentCount = 0;
    let developerInfo = null;

    try {
      const [unitResult] = await db
        .select({ count: count() })
        .from(units)
        .where(eq(units.development_id, developmentId));
      unitCount = Number(unitResult?.count || 0);
    } catch (e) {}

    try {
      const [docResult] = await db
        .select({ count: count() })
        .from(documents)
        .where(eq(documents.development_id, developmentId));
      documentCount = Number(docResult?.count || 0);
    } catch (e) {}

    if (developmentData.developer_user_id) {
      try {
        const [admin] = await db
          .select({ id: admins.id, email: admins.email })
          .from(admins)
          .where(eq(admins.id, developmentData.developer_user_id))
          .limit(1);
        developerInfo = admin || null;
      } catch (e) {}
    }

    const formattedDevelopment = {
      id: developmentData.id,
      name: developmentData.name,
      code: developmentData.code || '',
      slug: developmentData.slug || '',
      address: developmentData.address,
      description: developmentData.description || '',
      is_active: developmentData.is_active,
      created_at: developmentData.created_at,
      system_instructions: developmentData.system_instructions || '',
      logo_url: developmentData.logo_url,
      sidebar_logo_url: developmentData.sidebar_logo_url,
      assistant_logo_url: developmentData.assistant_logo_url,
      toolbar_logo_url: developmentData.toolbar_logo_url,
      tenant: developmentData.tenant_id
        ? {
            id: developmentData.tenant_id,
            name: developmentData.tenant_name || 'Unknown',
          }
        : null,
      developer: developerInfo,
      _count: {
        units: unitCount,
        homeowners: 0,
        documents: documentCount,
      },
    };

    return NextResponse.json({ development: formattedDevelopment });
  } catch (error: any) {
    console.error('[Super Development API] Error:', error);
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch development' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['super_admin', 'admin']);

    const developmentId = params.id;
    const body = await request.json();
    const { name, address, description, is_active } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (address !== undefined) updateData.address = address.trim() || null;
    if (description !== undefined) updateData.description = description.trim() || null;
    if (is_active !== undefined) updateData.is_active = is_active;

    await db
      .update(developments)
      .set(updateData)
      .where(eq(developments.id, developmentId));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Super Development API] Update error:', error);
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to update development' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['super_admin', 'admin']);

    const developmentId = params.id;

    await db.delete(developments).where(eq(developments.id, developmentId));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Super Development API] Delete error:', error);
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to delete development' }, { status: 500 });
  }
}
