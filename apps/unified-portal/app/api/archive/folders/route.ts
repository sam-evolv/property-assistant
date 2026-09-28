export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { archive_folders, developments } from '@openhouse/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { requireRole, type AdminSession } from '@/lib/supabase-server';

// SECURITY: non-super_admin users are always scoped to their own tenant; the
// client-supplied tenantId is only honoured for super_admin.
function resolveTenantId(session: AdminSession, clientTenantId: string | null | undefined): string {
  if (session.role === 'super_admin' && clientTenantId) {
    return clientTenantId;
  }
  return session.tenantId;
}

function authErrorResponse(error: unknown): NextResponse | null {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  if (errorMessage === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (errorMessage === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

// SECURITY: verify the development belongs to the resolved tenant
async function developmentBelongsToTenant(developmentId: string, tenantId: string): Promise<boolean> {
  const [dev] = await db
    .select({ id: developments.id })
    .from(developments)
    .where(and(eq(developments.id, developmentId), eq(developments.tenant_id, tenantId)))
    .limit(1);
  return !!dev;
}

// SECURITY: verify a parent folder belongs to the same tenant + development
async function folderBelongsTo(folderId: string, tenantId: string, developmentId: string): Promise<boolean> {
  const [folder] = await db
    .select({ id: archive_folders.id })
    .from(archive_folders)
    .where(
      and(
        eq(archive_folders.id, folderId),
        eq(archive_folders.tenant_id, tenantId),
        eq(archive_folders.development_id, developmentId)
      )
    )
    .limit(1);
  return !!folder;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const { searchParams } = new URL(request.url);
    const tenantId = resolveTenantId(session, searchParams.get('tenantId'));
    const developmentId = searchParams.get('developmentId');
    const discipline = searchParams.get('discipline');
    const parentFolderId = searchParams.get('parentFolderId');

    if (!tenantId || !developmentId || !discipline) {
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

    return NextResponse.json({ folders });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
    // Return empty folders array on database error to allow documents to display
    return NextResponse.json({ folders: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const body = await request.json();
    const { developmentId, discipline, name, parentFolderId, color, icon } = body;
    const tenantId = resolveTenantId(session, body.tenantId);

    if (!tenantId || !developmentId || !discipline || !name) {
      return NextResponse.json(
        { error: 'tenantId, developmentId, discipline, and name are required' },
        { status: 400 }
      );
    }

    if (!(await developmentBelongsToTenant(developmentId, tenantId))) {
      return NextResponse.json({ error: 'Development not found' }, { status: 404 });
    }

    if (parentFolderId && !(await folderBelongsTo(parentFolderId, tenantId, developmentId))) {
      return NextResponse.json({ error: 'Parent folder not found' }, { status: 404 });
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
    const authError = authErrorResponse(error);
    if (authError) return authError;
    return NextResponse.json(
      { error: 'Failed to create folder' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const body = await request.json();
    const { id, developmentId, discipline, name, color, icon, parentFolderId, sortOrder } = body;
    const tenantId = resolveTenantId(session, body.tenantId);

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
    if (parentFolderId !== undefined) {
      if (parentFolderId) {
        if (parentFolderId === id || !(await folderBelongsTo(parentFolderId, tenantId, developmentId))) {
          return NextResponse.json({ error: 'Parent folder not found' }, { status: 404 });
        }
      }
      updateData.parent_folder_id = parentFolderId || null;
    }
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
    const authError = authErrorResponse(error);
    if (authError) return authError;
    return NextResponse.json(
      { error: 'Failed to update folder' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const body = await request.json();
    const { id, developmentId, discipline } = body;
    const tenantId = resolveTenantId(session, body.tenantId);

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
    const authError = authErrorResponse(error);
    if (authError) return authError;
    return NextResponse.json(
      { error: 'Failed to delete folder' },
      { status: 500 }
    );
  }
}
