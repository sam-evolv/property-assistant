export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { archive_folders } from '@openhouse/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireRole } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // SECURITY: middleware skips /api/* — authenticate here. Non-super_admin users are
    // always scoped to their own tenant; client tenantId is only honoured for super_admin.
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const clientTenantId = searchParams.get('tenantId');
    const tenantId =
      session.role === 'super_admin' && clientTenantId ? clientTenantId : session.tenantId;
    const developmentId = searchParams.get('developmentId');

    if (!id || !tenantId || !developmentId) {
      return NextResponse.json(
        { error: 'id, tenantId, and developmentId are required' },
        { status: 400 }
      );
    }

    const [folder] = await db
      .select()
      .from(archive_folders)
      .where(
        and(
          eq(archive_folders.id, id),
          eq(archive_folders.tenant_id, tenantId),
          eq(archive_folders.development_id, developmentId)
        )
      )
      .limit(1);

    if (!folder) {
      return NextResponse.json(
        { error: 'Folder not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ folder });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (errorMessage === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Failed to fetch folder' },
      { status: 500 }
    );
  }
}
