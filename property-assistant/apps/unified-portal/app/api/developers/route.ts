import { NextRequest, NextResponse } from 'next/server';
import {
  getAllDevelopers,
  createAdmin,
  type AdminRole,
} from '@openhouse/api/rbac';
import { getAdminContextFromSession, isSuperAdmin } from '@/lib/api-auth';
import { db } from '@openhouse/db/client';
import { tenants } from '@openhouse/db/schema';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const adminContext = await getAdminContextFromSession();
    
    if (!adminContext || !isSuperAdmin(adminContext)) {
      return NextResponse.json(
        { error: 'Unauthorized. Super-admin access required.' },
        { status: 403 }
      );
    }

    const developers = await getAllDevelopers();

    return NextResponse.json({ developers });
  } catch (error) {
    console.error('[DEVELOPERS] Error fetching developers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch developers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminContext = await getAdminContextFromSession();
    
    if (!adminContext || !isSuperAdmin(adminContext)) {
      return NextResponse.json(
        { error: 'Unauthorized. Super-admin access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, tenantSlug, role = 'developer' } = body;

    if (!email || !tenantSlug) {
      return NextResponse.json(
        { error: 'Email and tenant slug are required' },
        { status: 400 }
      );
    }

    const tenant = await db.query.tenants.findFirst({
      where: (tenants, { eq }) => eq(tenants.slug, tenantSlug),
      columns: { id: true, name: true, slug: true },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    const developer = await createAdmin({
      email,
      role: role as AdminRole,
      tenantId: tenant.id,
    });

    console.log(`[DEVELOPERS] Created developer: ${developer.email} for tenant ${tenant.name}`);

    return NextResponse.json({
      developer: {
        ...developer,
        tenant,
      },
    });
  } catch (error) {
    console.error('[DEVELOPERS] Error creating developer:', error);
    return NextResponse.json(
      { error: 'Failed to create developer' },
      { status: 500 }
    );
  }
}
