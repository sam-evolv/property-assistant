export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { archive_folders } from '@openhouse/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const developmentId = searchParams.get('developmentId');
    const discipline = searchParams.get('discipline');
    const parentFolderId = searchParams.get('parentFolderId');

    console.log('[API /archive/folders] GET request:', { tenantId, developmentId, discipline, parentFolderId });

    if (!tenantId || !developmentId || !discipline) {
      console.log('[API /archive/folders] Missing required params');
      return NextResponse.json(
        { error: 'tenantId, developmentId, and discipline are required' },
        { status: 400 }
      );
    }

    let query;
    if (parentFolderId) {
      query = db
        .select()
        .from(archive_folders)
        .where(
          and(
            eq(archive_folders.tenant_id, tenantId),
            eq(archive_folders.development_id, developmentId),
            eq(archive_folders.discipline, discipline),
            eq(archive_folders.parent_folder_id, parentFolderId)
          )
        )
        .orderBy(archive_folders.sort_order, archive_folders.name)
        .limit(100);
    } else {
      query = db
        .select()
        .from(archive_folders)
        .where(
          and(
            eq(archive_folders.tenant_id, tenantId),
            eq(archive_folders.development_id, developmentId),
            eq(archive_folders.discipline, discipline),
            isNull(archive_folders.parent_folder_id)
          )
        )
        .orderBy(archive_folders.sort_order, archive_folders.name)
        .limit(100);
    }

    const folders = await query;
    console.log('[API /archive/folders] Found', folders.length, 'folders');

    return NextResponse.json({ folders });
  } catch (error) {
    console.error('[API /archive/folders] Error:', error instanceof Error ? error.message : error);
    console.error('[API /archive/folders] Stack:', error instanceof Error ? error.stack : 'N/A');
    // Return empty folders array on database error to allow documents to display
    console.log('[API /archive/folders] Returning empty folders due to database error');
    return NextResponse.json({ folders: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, developmentId, discipline, name, parentFolderId, color, icon } = body;

    if (!tenantId || !developmentId || !discipline || !name) {
      return NextResponse.json(
        { error: 'tenantId, developmentId, discipline, and name are required' },
        { status: 400 }
      );
    }

    const [folder] = await db
      .insert(archive_folders)
      .values({
        tenant_id: tenantId,
        development_id: developmentId,
        discipline,
        name: name.trim(),
        parent_folder_id: parentFolderId || null,
        color: color || null,
        icon: icon || null,
        sort_order: 0,
      })
      .returning();

    return NextResponse.json({ folder, success: true });
  } catch (error) {
    console.error('[API] Error creating folder:', error);
    return NextResponse.json(
      { error: 'Failed to create folder' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, tenantId, developmentId, discipline, name, color, icon, parentFolderId, sortOrder } = body;

    if (!id || !tenantId || !developmentId || !discipline) {
      return NextResponse.json(
        { error: 'id, tenantId, developmentId, and discipline are required' },
        { status: 400 }
      );
    }

    const updateData: Record<string, any> = {
      updated_at: new Date(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (color !== undefined) updateData.color = color;
    if (icon !== undefined) updateData.icon = icon;
    if (parentFolderId !== undefined) updateData.parent_folder_id = parentFolderId;
    if (sortOrder !== undefined) updateData.sort_order = sortOrder;

    const [folder] = await db
      .update(archive_folders)
      .set(updateData)
      .where(
        and(
          eq(archive_folders.id, id),
          eq(archive_folders.tenant_id, tenantId),
          eq(archive_folders.development_id, developmentId),
          eq(archive_folders.discipline, discipline)
        )
      )
      .returning();

    if (!folder) {
      return NextResponse.json(
        { error: 'Folder not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ folder, success: true });
  } catch (error) {
    console.error('[API] Error updating folder:', error);
    return NextResponse.json(
      { error: 'Failed to update folder' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, tenantId, developmentId, discipline } = body;

    if (!id || !tenantId || !developmentId || !discipline) {
      return NextResponse.json(
        { error: 'id, tenantId, developmentId, and discipline are required' },
        { status: 400 }
      );
    }

    const childFolders = await db
      .select()
      .from(archive_folders)
      .where(
        and(
          eq(archive_folders.parent_folder_id, id),
          eq(archive_folders.tenant_id, tenantId),
          eq(archive_folders.development_id, developmentId)
        )
      );

    if (childFolders.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete folder with subfolders. Please delete subfolders first.' },
        { status: 400 }
      );
    }

    const [deleted] = await db
      .delete(archive_folders)
      .where(
        and(
          eq(archive_folders.id, id),
          eq(archive_folders.tenant_id, tenantId),
          eq(archive_folders.development_id, developmentId),
          eq(archive_folders.discipline, discipline)
        )
      )
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: 'Folder not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: 'Folder deleted' });
  } catch (error) {
    console.error('[API] Error deleting folder:', error);
    return NextResponse.json(
      { error: 'Failed to delete folder' },
      { status: 500 }
    );
  }
}
