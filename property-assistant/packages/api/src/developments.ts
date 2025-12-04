import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { developments, admins } from '@openhouse/db/schema';
import { eq, sql, or, and } from 'drizzle-orm';
import { getAdminSession, isSuperAdmin, isDeveloper, canAccessDevelopment } from './session';

export const runtime = 'nodejs';

export async function handleGetDevelopments(req: NextRequest) {
  try {
    const adminContext = await getAdminSession();
    
    if (!adminContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let devs;

    if (isSuperAdmin(adminContext)) {
      devs = await db.query.developments.findMany({
        orderBy: (developments, { desc }) => [desc(developments.created_at)],
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
    } else if (isDeveloper(adminContext)) {
      devs = await db.query.developments.findMany({
        where: (developments, { eq, and }) =>
          and(
            eq(developments.developer_user_id, adminContext.id),
            eq(developments.tenant_id, adminContext.tenantId)
          ),
        orderBy: (developments, { desc }) => [desc(developments.created_at)],
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
    } else {
      devs = await db
        .select()
        .from(developments)
        .where(eq(developments.tenant_id, adminContext.tenantId))
        .orderBy(sql`created_at DESC`);
    }

    return NextResponse.json({ success: true, developments: devs });
  } catch (error) {
    console.error('Error fetching developments:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch developments' },
      { status: 500 }
    );
  }
}

export async function handleCreateDevelopment(req: NextRequest) {
  try {
    const adminContext = await getAdminSession();
    
    if (!adminContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: any = await req.json();
    const { name, address, description, systemInstructions, tenantId, developerUserId } = body;

    if (!name || !address) {
      return NextResponse.json(
        { error: 'name and address are required' },
        { status: 400 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenantId' },
        { status: 400 }
      );
    }

    if (!isSuperAdmin(adminContext) && tenantId !== adminContext.tenantId) {
      return NextResponse.json(
        { error: 'Non-super-admins can only create developments for their own tenant' },
        { status: 403 }
      );
    }

    let assignedDeveloperId = developerUserId;
    
    if (isDeveloper(adminContext)) {
      assignedDeveloperId = adminContext.id;
    }

    if (assignedDeveloperId && !isSuperAdmin(adminContext)) {
      const developerAdmin = await db
        .select()
        .from(admins)
        .where(eq(admins.id, assignedDeveloperId))
        .limit(1);
      
      if (!developerAdmin || developerAdmin.length === 0) {
        return NextResponse.json(
          { error: 'Developer not found' },
          { status: 404 }
        );
      }
      
      if (developerAdmin[0].tenant_id !== adminContext.tenantId) {
        return NextResponse.json(
          { error: 'Cannot assign developers from other tenants' },
          { status: 403 }
        );
      }
    }

    const result = await db.insert(developments).values({
      tenant_id: tenantId,
      name,
      address,
      description: description || '',
      system_instructions: systemInstructions || '',
      created_by: adminContext.id,
      developer_user_id: assignedDeveloperId || null,
    }).returning();

    console.log(`[DEVELOPMENT] Created: ${name} for tenant ${tenantId}, developer: ${assignedDeveloperId || 'none'}`);

    return NextResponse.json({ 
      success: true, 
      developmentId: result[0].id 
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating development:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create development' },
      { status: 500 }
    );
  }
}

export async function handleGetDevelopment(req: NextRequest, developmentId: string) {
  try {
    const adminContext = await getAdminSession();
    
    if (!adminContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasAccess = await canAccessDevelopment(adminContext, developmentId);
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to this development' },
        { status: 403 }
      );
    }

    const development = await db
      .select()
      .from(developments)
      .where(eq(developments.id, developmentId))
      .limit(1);

    if (!development || development.length === 0) {
      return NextResponse.json(
        { error: 'Development not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      development: development[0] 
    });
  } catch (error) {
    console.error('Error fetching development:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch development' },
      { status: 500 }
    );
  }
}

export async function handleUpdateDevelopment(req: NextRequest, developmentId: string) {
  try {
    const adminContext = await getAdminSession();
    
    if (!adminContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasAccess = await canAccessDevelopment(adminContext, developmentId);
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to this development' },
        { status: 403 }
      );
    }

    const body: any = await req.json();
    const { systemInstructions } = body;

    const result = await db
      .update(developments)
      .set({
        system_instructions: systemInstructions,
      })
      .where(eq(developments.id, developmentId))
      .returning();

    if (!result || result.length === 0) {
      return NextResponse.json(
        { error: 'Development not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      development: result[0],
    });
  } catch (error) {
    console.error('Error updating development:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update development' },
      { status: 500 }
    );
  }
}

export async function handleDeleteDevelopment(req: NextRequest, developmentId: string) {
  try {
    const adminContext = await getAdminSession();
    
    if (!adminContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasAccess = await canAccessDevelopment(adminContext, developmentId);
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to this development' },
        { status: 403 }
      );
    }

    await db
      .delete(developments)
      .where(eq(developments.id, developmentId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting development:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete development' },
      { status: 500 }
    );
  }
}
