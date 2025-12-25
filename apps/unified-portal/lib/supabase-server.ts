import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { AdminRole, AdminSession } from './types';

export type { AdminRole, AdminSession } from './types';

export async function createServerSupabaseClient() {
  return createServerComponentClient({ cookies });
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase configuration missing');
  }
  return createClient(url, key);
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
    
    const supabaseAdmin = getSupabaseAdmin();
    const { data: admin, error: adminError } = await supabaseAdmin
      .from('admins')
      .select('id, email, role, tenant_id')
      .eq('email', userEmail)
      .single();

    if (adminError && adminError.code !== 'PGRST116') {
      console.error('[AUTH] Error fetching admin:', adminError.message);
      return { status: 'not_authenticated', reason: adminError.message };
    }

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
