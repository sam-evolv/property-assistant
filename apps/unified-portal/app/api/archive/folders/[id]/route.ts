export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { archive_folders } from '@openhouse/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
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
    console.error('[API] Error fetching folder:', error);
    return NextResponse.json(
      { error: 'Failed to fetch folder' },
      { status: 500 }
    );
  }
}
