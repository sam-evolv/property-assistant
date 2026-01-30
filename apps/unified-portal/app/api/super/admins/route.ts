import { NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { admins, tenants } from '@openhouse/db/schema';
import { eq, sql } from 'drizzle-orm';
import { requireRole } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireRole(['super_admin']);

    const adminsData = await db
      .select({
        id: admins.id,
        email: admins.email,
        role: admins.role,
        tenant_id: admins.tenant_id,
        tenant_name: tenants.name,
        created_at: admins.created_at,
      })
      .from(admins)
      .leftJoin(tenants, eq(admins.tenant_id, tenants.id))
      .orderBy(sql`${admins.created_at} DESC`);

    const formattedAdmins = adminsData.map(admin => ({
      id: admin.id,
      email: admin.email,
      role: admin.role,
      tenant_id: admin.tenant_id,
      tenant_name: admin.tenant_name,
      created_at: admin.created_at,
      is_active: true,
    }));

    const stats = {
      total: formattedAdmins.length,
      superAdmins: formattedAdmins.filter(a => a.role === 'super_admin').length,
      admins: formattedAdmins.filter(a => a.role === 'admin').length,
      developers: formattedAdmins.filter(a => a.role === 'developer').length,
    };

    return NextResponse.json({ 
      admins: formattedAdmins,
      users: formattedAdmins,
      stats,
    });
  } catch (error: any) {
    console.error('[Super Admins API] Error:', error);
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 });
  }
}
