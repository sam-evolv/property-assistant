import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { db } from '@openhouse/db/client';
import { admins } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';

export type AdminRole = 'super_admin' | 'developer' | 'admin';

export interface AdminSession {
  id: string;
  email: string;
  role: AdminRole;
  tenantId: string;
}

export async function createServerSupabaseClient() {
  return createServerComponentClient({ cookies });
}

async function retryDBQuery<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 100
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries - 1;
      const isConnectionError = error?.code === '57P01' || error?.message?.includes('terminating connection');
      
      if (isLastAttempt || !isConnectionError) {
        throw error;
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
    }
  }
  throw new Error('Retry exhausted');
}

export async function getServerSession(): Promise<AdminSession | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user?.email) {
      return null;
    }

    const admin = await retryDBQuery(() =>
      db.query.admins.findFirst({
        where: eq(admins.email, user.email),
        columns: {
          id: true,
          email: true,
          role: true,
          tenant_id: true,
        },
      })
    );

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
    console.error('[AUTH] Failed to get session:', error);
    return null;
  }
}

export async function requireSession(): Promise<AdminSession> {
  const session = await getServerSession();
  
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }

  return session;
}

export async function requireRole(allowedRoles: AdminRole[]): Promise<AdminSession> {
  const session = await requireSession();

  if (!allowedRoles.includes(session.role)) {
    throw new Error('FORBIDDEN');
  }

  return session;
}
