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
    const admin = await retryDBQuery(() =>
      db.query.admins.findFirst({
        where: eq(admins.email, userEmail),
        columns: {
          id: true,
          email: true,
          role: true,
          tenant_id: true,
        },
      })
    );

    if (!admin) {
      console.log('[AUTH] User authenticated but not provisioned:', user.email);
      return { 
        status: 'not_provisioned', 
        email: user.email,
        reason: 'Account not set up for portal access. Please contact your administrator.'
      };
    }

    return {
      status: 'authenticated',
      session: {
        id: admin.id,
        email: admin.email,
        role: admin.role as AdminRole,
        tenantId: admin.tenant_id,
      }
    };
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
