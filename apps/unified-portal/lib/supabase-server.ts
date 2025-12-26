import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { db } from '@openhouse/db/client';
import { admins } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import type { AdminRole, AdminSession } from './types';

export type { AdminRole, AdminSession } from './types';

export async function createServerSupabaseClient() {
  return createServerComponentClient({ cookies });
}

export type SessionResult = 
  | { status: 'authenticated'; session: AdminSession }
  | { status: 'not_authenticated'; reason: string }
  | { status: 'not_provisioned'; email: string; reason: string };

export async function getServerSessionWithStatus(): Promise<SessionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.log('[AUTH] Supabase auth error:', error.message);
      return { status: 'not_authenticated', reason: error.message };
    }

    if (!user?.email) {
      return { status: 'not_authenticated', reason: 'No active session' };
    }

    const userEmail = user.email as string;
    
    try {
      const admin = await db.query.admins.findFirst({
        where: eq(admins.email, userEmail),
        columns: {
          id: true,
          email: true,
          role: true,
          tenant_id: true,
        },
      });

      if (!admin) {
        console.log('[AUTH] User authenticated but not provisioned:', user.email);
        return { 
          status: 'not_provisioned', 
          email: user.email,
          reason: 'Account not set up for portal access. Please contact your administrator.'
        };
      }

      console.log('[AUTH] Admin found in Drizzle DB:', admin.email, 'role:', admin.role);
      return {
        status: 'authenticated',
        session: {
          id: admin.id,
          email: admin.email,
          role: admin.role as AdminRole,
          tenantId: admin.tenant_id,
        }
      };
    } catch (dbError: any) {
      console.error('[AUTH] Drizzle DB error fetching admin:', dbError.message);
      return { status: 'not_authenticated', reason: 'Database error: ' + dbError.message };
    }
  } catch (error: any) {
    console.error('[AUTH] Failed to get session:', error);
    return { status: 'not_authenticated', reason: error.message || 'Session check failed' };
  }
}

export async function getServerSession(): Promise<AdminSession | null> {
  const result = await getServerSessionWithStatus();
  if (result.status === 'authenticated') {
    return result.session;
  }
  return null;
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
