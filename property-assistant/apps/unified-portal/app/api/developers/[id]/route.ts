import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminContext,
  isSuperAdmin,
} from '@openhouse/api/rbac';
import { db } from '@openhouse/db/client';
import { admins } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminContext = await getAdminContext(request);
    
    if (!adminContext || !isSuperAdmin(adminContext)) {
      return NextResponse.json(
        { error: 'Unauthorized. Super-admin access required.' },
        { status: 403 }
      );
    }

    const developer = await db.query.admins.findFirst({
      where: eq(admins.id, params.id),
      with: {
        tenant: {
          columns: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!developer) {
      return NextResponse.json(
        { error: 'Developer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ developer });
  } catch (error) {
    console.error('[DEVELOPER] Error fetching developer:', error);
    return NextResponse.json(
      { error: 'Failed to fetch developer' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminContext = await getAdminContext(request);
    
    if (!adminContext || !isSuperAdmin(adminContext)) {
      return NextResponse.json(
        { error: 'Unauthorized. Super-admin access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, role } = body;

    const updateData: any = {};
    if (email) updateData.email = email;
    if (role) updateData.role = role;

    const [updated] = await db
      .update(admins)
      .set(updateData)
      .where(eq(admins.id, params.id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: 'Developer not found' },
        { status: 404 }
      );
    }

    console.log(`[DEVELOPER] Updated developer: ${updated.email}`);

    return NextResponse.json({ developer: updated });
  } catch (error) {
    console.error('[DEVELOPER] Error updating developer:', error);
    return NextResponse.json(
      { error: 'Failed to update developer' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminContext = await getAdminContext(request);
    
    if (!adminContext || !isSuperAdmin(adminContext)) {
      return NextResponse.json(
        { error: 'Unauthorized. Super-admin access required.' },
        { status: 403 }
      );
    }

    const [deleted] = await db
      .delete(admins)
      .where(eq(admins.id, params.id))
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { error: 'Developer not found' },
        { status: 404 }
      );
    }

    console.log(`[DEVELOPER] Deleted developer: ${deleted.email}`);

    return NextResponse.json({ success: true, developer: deleted });
  } catch (error) {
    console.error('[DEVELOPER] Error deleting developer:', error);
    return NextResponse.json(
      { error: 'Failed to delete developer' },
      { status: 500 }
    );
  }
}
