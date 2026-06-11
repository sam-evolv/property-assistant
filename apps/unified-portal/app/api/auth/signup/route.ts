export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase-server';

/**
 * Self-serve signup: one request creates the auth user, tenant, admin row
 * and first scheme, then signs the cookie session in — the developer lands
 * on Today's go-live checklist with step 1 already done.
 *
 * The role/tenant model needs nothing else: every request resolves the
 * admins row by email (lib/supabase-server.ts), so there are no claims to
 * mint. Super-admin provisioning (/api/auth/provision-developer) remains
 * the enterprise path.
 */

const SignupSchema = z.object({
  fullName: z.string().trim().min(2, 'Tell us your name').max(120),
  companyName: z.string().trim().max(120).optional().default(''),
  email: z.string().trim().toLowerCase().email('That email doesn\'t look right'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  schemeName: z.string().trim().min(2, 'Name your first scheme').max(120),
  county: z.string().trim().max(40).optional().default(''),
});

// Simple in-memory rate limit: 5 attempts/minute per IP.
const attempts = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  attempts.set(ip, recent);
  if (attempts.size > 5000) attempts.clear();
  return recent.length > MAX_ATTEMPTS;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function randomSuffix(length: number): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'Too many attempts — try again in a minute.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message || 'Check the form and try again' }, { status: 400 });
  }
  const { fullName, companyName, email, password, schemeName, county } = parsed.data;

  const supabase = getSupabaseAdmin();

  // Existing admin → this is a sign-in, not a sign-up.
  const { data: existingAdmin } = await supabase
    .from('admins')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (existingAdmin) {
    return NextResponse.json(
      { error: 'An account with this email already exists — sign in instead.' },
      { status: 409 },
    );
  }

  // Created so far, for best-effort compensation on failure.
  let tenantId: string | null = null;
  let adminId: string | null = null;
  let developmentId: string | null = null;
  let authUserId: string | null = null;

  const compensate = async () => {
    try {
      if (authUserId) await supabase.auth.admin.deleteUser(authUserId);
    } catch {}
    try {
      if (developmentId) await supabase.from('developments').delete().eq('id', developmentId);
    } catch {}
    try {
      if (adminId) await supabase.from('admins').delete().eq('id', adminId);
    } catch {}
    try {
      if (tenantId) await supabase.from('tenants').delete().eq('id', tenantId);
    } catch {}
  };

  try {
    // 1. Tenant
    const tenantName = companyName || `${fullName} Developments`;
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: tenantName,
        slug: `${slugify(tenantName)}-${Date.now()}`,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (tenantError || !tenant) throw new Error(`tenant: ${tenantError?.message}`);
    tenantId = tenant.id;

    // 2. Admin (role resolution is by email — this row IS the account's access)
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .insert({
        email,
        role: 'developer',
        tenant_id: tenantId,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (adminError || !admin) throw new Error(`admin: ${adminError?.message}`);
    adminId = admin.id;

    // 3. First scheme — developer_user_id makes it manageable by this account
    const { data: development, error: devError } = await supabase
      .from('developments')
      .insert({
        tenant_id: tenantId,
        code: `${slugify(schemeName).toUpperCase().slice(0, 20) || 'SCHEME'}-${randomSuffix(4)}`,
        name: schemeName,
        slug: `${slugify(schemeName)}-${randomSuffix(4).toLowerCase()}`,
        address: county || null,
        developer_user_id: adminId,
        created_by: adminId,
        is_active: true,
      })
      .select('id, name')
      .single();
    if (devError || !development) throw new Error(`development: ${devError?.message}`);
    developmentId = development.id;

    // 4. Auth user — email_confirm so access is instant
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, company_name: tenantName },
    });
    if (createError || !created?.user) {
      const msg = createError?.message?.toLowerCase() || '';
      if (msg.includes('already registered') || msg.includes('already exists')) {
        await compensate();
        return NextResponse.json(
          { error: 'An account with this email already exists — sign in instead.' },
          { status: 409 },
        );
      }
      throw new Error(`auth: ${createError?.message}`);
    }
    authUserId = created.user.id;

    // 5. Cookie session in the same request
    const cookieStore = cookies();
    const routeClient = createRouteHandlerClient({ cookies: () => cookieStore });
    const { error: signInError } = await routeClient.auth.signInWithPassword({ email, password });
    if (signInError) throw new Error(`signin: ${signInError.message}`);

    // Owner visibility, never blocking
    try {
      const origin = request.nextUrl.origin;
      fetch(`${origin}/api/notify/new-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: fullName, company: tenantName, scheme: schemeName }),
      }).catch(() => {});
    } catch {}

    return NextResponse.json({
      success: true,
      redirectTo: '/developer',
      tenantId,
      developmentId,
    });
  } catch (error) {
    console.error('[SIGNUP] Failed:', error instanceof Error ? error.message : error);
    await compensate();
    return NextResponse.json(
      { error: 'Something went wrong setting up your account — please try again.' },
      { status: 500 },
    );
  }
}
