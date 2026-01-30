import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { db } from '@openhouse/db/client';
import { admins } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import type { AdminRole, AdminSession } from './types';

export type { AdminRole, AdminSession } from './types';

export async function createServerSupabaseClient() {
  return createServerComponentClient({ cookies });
}

export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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

    // Try Drizzle first, fallback to Supabase
    let admin: any = null;

    try {
      admin = await db.query.admins.findFirst({
        where: eq(admins.email, userEmail),
        columns: {
          id: true,
          email: true,
          role: true,
          preferred_role: true,
          tenant_id: true,
        },
      });
      console.log('[AUTH] Admin found via Drizzle:', !!admin);
    } catch (dbError: any) {
      console.error('[AUTH] Drizzle DB error (falling back to Supabase):', dbError.message);

      // Fallback to Supabase
      try {
        const supabaseAdmin = getSupabaseAdmin();
        const { data: supabaseAdminData, error: supabaseError } = await supabaseAdmin
          .from('admins')
          .select('id, email, role, preferred_role, tenant_id')
          .eq('email', userEmail)
          .single();

        if (supabaseError && supabaseError.code !== 'PGRST116') {
          console.error('[AUTH] Supabase fallback error:', supabaseError);
        }
        admin = supabaseAdminData;
        console.log('[AUTH] Admin found via Supabase fallback:', !!admin);
      } catch (fallbackError: any) {
        console.error('[AUTH] Supabase fallback failed:', fallbackError.message);
        return { status: 'not_authenticated', reason: 'Database error: ' + dbError.message };
      }
    }

    if (!admin) {
      console.log('[AUTH] User authenticated but not provisioned:', user.email);
      return {
        status: 'not_provisioned',
        email: user.email,
        reason: 'Account not set up for portal access. Please contact your administrator.'
      };
    }

    const displayName = user.user_metadata?.full_name || null;
    console.log('[AUTH] Admin found:', admin.email, 'role:', admin.role, 'displayName:', displayName);
    return {
      status: 'authenticated',
      session: {
        id: admin.id,
        email: admin.email,
        role: admin.role as AdminRole,
        preferredRole: admin.preferred_role as AdminRole | null,
        tenantId: admin.tenant_id,
        displayName,
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
