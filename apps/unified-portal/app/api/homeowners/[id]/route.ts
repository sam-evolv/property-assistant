export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, canAccessDevelopment } from '@openhouse/api/session';
import { db } from '@openhouse/db/client';
import { homeowners } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminContext = await getAdminSession();
    
    if (!adminContext) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const homeowner = await db.query.homeowners.findFirst({
      where: eq(homeowners.id, id),
    });

    if (!homeowner) {
      return NextResponse.json({ error: 'Homeowner not found' }, { status: 404 });
    }

    const hasAccess = await canAccessDevelopment(adminContext, homeowner.development_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { name, house_type, address, development_id } = body;

    const updateData: Partial<typeof homeowner> = {};
    
    if (name !== undefined) updateData.name = name;
    if (house_type !== undefined) updateData.house_type = house_type || null;
    if (address !== undefined) updateData.address = address || null;
    
    if (development_id && development_id !== homeowner.development_id) {
      const hasNewDevAccess = await canAccessDevelopment(adminContext, development_id);
      if (!hasNewDevAccess) {
        return NextResponse.json({ error: 'Access denied to target development' }, { status: 403 });
      }
      updateData.development_id = development_id;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const [updated] = await db
      .update(homeowners)
      .set(updateData)
      .where(eq(homeowners.id, id))
      .returning();

    console.log(`[HOMEOWNERS] Updated: ${updated.name} (${id})`);

    return NextResponse.json({ homeowner: updated });
  } catch (error) {
    console.error('[HOMEOWNERS] Error updating:', error);
    return NextResponse.json({ error: 'Failed to update homeowner' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminContext = await getAdminSession();
    
    if (!adminContext) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const homeowner = await db.query.homeowners.findFirst({
      where: eq(homeowners.id, id),
    });

    if (!homeowner) {
      return NextResponse.json({ error: 'Homeowner not found' }, { status: 404 });
    }

    const hasAccess = await canAccessDevelopment(adminContext, homeowner.development_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await db.delete(homeowners).where(eq(homeowners.id, id));

    console.log(`[HOMEOWNERS] Deleted: ${homeowner.name} (${id})`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[HOMEOWNERS] Error deleting:', error);
    return NextResponse.json({ error: 'Failed to delete homeowner' }, { status: 500 });
  }
}
