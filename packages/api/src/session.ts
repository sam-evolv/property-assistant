import { NextRequest } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { db } from '@openhouse/db/client';
import { admins } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';

// Re-export types and functions from rbac to avoid duplication
export type { AdminRole, AdminContext as AdminSession } from './rbac';
export { isSuperAdmin, isDeveloper, isAdmin, canAccessDevelopment } from './rbac';

async function getSupabaseClient() {
  return createServerComponentClient({ cookies });
}

export async function getAdminSession() {
  try {
    const supabase = await getSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user?.email) {
      return null;
    }

    const admin = await db.query.admins.findFirst({
      where: (admins, { eq }) => eq(admins.email, user.email),
      columns: {
        id: true,
        email: true,
        role: true,
        tenant_id: true,
      },
    });

    if (!admin) {
      return null;
    }

    return {
      id: admin.id,
      email: admin.email,
      role: admin.role as AdminRole,
      tenantId: admin.tenant_id,
    };
  } catch (error) {
    console.error('[SESSION] Failed to get admin session:', error);
    return null;
  }
}
