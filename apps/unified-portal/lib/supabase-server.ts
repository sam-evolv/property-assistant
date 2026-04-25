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

/**
 * Service-role Supabase client. Bypasses RLS — use only in server code where
 * the request has already been authorised by the route handler.
 *
 * Session 14.4 — fail-fast on misconfigured environments. Three regressions
 * (Sessions 6A, 14, 14.2/3) all looked like data bugs but the smoking gun
 * was that `process.env.SUPABASE_SERVICE_ROLE_KEY` was unset on the
 * preview deployment scope. With the old `process.env.X!` pattern, an
 * undefined value silently became `undefined` at runtime, supabase-js
 * accepted it without complaint, every query then ran as `anon`, and
 * RLS surfaced an empty-but-error-free result. Downstream code read
 * "(none)" as "this agent has no schemes" and told the user a verifiable
 * lie.
 *
 * Now: any call site discovers a misconfiguration on the FIRST request
 * after deploy, with a message that names the missing variable and tells
 * the operator exactly where to fix it. Anti-pattern #1 (silently anon)
 * is gone; anti-pattern #2 (using the anon key by mistake) is detected
 * with a structural check on the JWT payload.
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      '[supabase-admin] NEXT_PUBLIC_SUPABASE_URL is not set. ' +
        'Add it to the Vercel project (all environments: Production, Preview, Development) and redeploy.',
    );
  }
  if (!serviceKey) {
    throw new Error(
      '[supabase-admin] SUPABASE_SERVICE_ROLE_KEY is not set. ' +
        'This is the bug behind every "Assigned: (none)" / "no schemes assigned" report. ' +
        'Add it to the Vercel project and tick BOTH Production AND Preview, then redeploy. ' +
        'Without it the chat route silently degrades to anon-role queries which RLS blocks.',
    );
  }

  // Best-effort sanity check: a Supabase service-role JWT's payload
  // contains `"role":"service_role"`. The anon key contains `"role":"anon"`.
  // If somebody has accidentally pasted the anon key into the
  // SUPABASE_SERVICE_ROLE_KEY slot (a specific real-world failure mode)
  // we surface it loudly rather than silently degrading. We DON'T verify
  // the JWT signature — that's overkill — we just inspect the visible
  // payload. JWT format: header.payload.signature, all base64url.
  try {
    const payloadBase64 = serviceKey.split('.')[1];
    if (payloadBase64) {
      const padded = payloadBase64.padEnd(payloadBase64.length + ((4 - (payloadBase64.length % 4)) % 4), '=');
      const payloadJson = Buffer.from(padded, 'base64').toString('utf8');
      const payload = JSON.parse(payloadJson);
      if (payload?.role && payload.role !== 'service_role') {
        throw new Error(
          `[supabase-admin] SUPABASE_SERVICE_ROLE_KEY decodes to role="${payload.role}" — expected "service_role". ` +
            'You almost certainly pasted the anon key into the service-role slot in Vercel. ' +
            'Fix: Vercel → Settings → Environment Variables → SUPABASE_SERVICE_ROLE_KEY → paste the value labelled "service_role secret" from Supabase → Project Settings → API.',
        );
      }
    }
  } catch (err: any) {
    // If the message starts with our diagnostic, re-throw as-is. Otherwise
    // the JWT couldn't be parsed (malformed key, etc.) — also a problem,
    // surface it.
    if (typeof err?.message === 'string' && err.message.startsWith('[supabase-admin]')) {
      throw err;
    }
    throw new Error(
      `[supabase-admin] SUPABASE_SERVICE_ROLE_KEY is set but does not look like a JWT (${err?.message || err}). ` +
        'Verify the value in Vercel matches what Supabase shows under Project Settings → API → service_role secret.',
    );
  }

  return createClient(url, serviceKey, {
    // Service-role clients never need session persistence and shouldn't
    // attempt token refresh; both default to true in supabase-js, which
    // can introduce subtle quirks in serverless cold-start paths.
    auth: { persistSession: false, autoRefreshToken: false },
  });
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

    type AdminRecord = {
      id: string;
      email: string;
      role: string;
      preferred_role: string | null;
      tenant_id: string | null;
    };

    // Try Drizzle first, fallback to Supabase
    let admin: AdminRecord | null = null;

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
      }) ?? null;
      console.log('[AUTH] Admin found via Drizzle:', !!admin);
    } catch (dbError: unknown) {
      const dbMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
      console.error('[AUTH] Drizzle DB error (falling back to Supabase):', dbMessage);

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
      } catch (fallbackError: unknown) {
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
        console.error('[AUTH] Supabase fallback failed:', fallbackMessage);
        return { status: 'not_authenticated', reason: 'Database error: ' + dbMessage };
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
  } catch (error: unknown) {
    console.error('[AUTH] Failed to get session:', error);
    return { status: 'not_authenticated', reason: error instanceof Error ? error.message : 'Session check failed' };
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
