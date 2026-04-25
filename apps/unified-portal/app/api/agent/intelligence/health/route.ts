import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { resolveAgentContext } from '@/lib/agent-intelligence/agent-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/intelligence/health
 *
 * Session 14.4 — operator-facing self-test for the agent intelligence
 * stack. Always returns environment diagnostics; if a caller is logged
 * in, also runs a per-user resolver consistency check.
 *
 * Three checks, in order:
 *
 *   ENV: SUPABASE_SERVICE_ROLE_KEY is set and decodes to role=service_role
 *        NEXT_PUBLIC_SUPABASE_URL is set and parsable
 *        Service-role client can SELECT from a non-empty system table
 *
 *   AUTH: caller has a session (skipped if not — env block still returned)
 *
 *   USER: resolveAgentContext returns a profile with assignments, AND
 *         the resolver count matches a service-role probe count
 *
 * The ENV block is intentionally PII-free — safe to call without auth.
 * It exposes:
 *   - URL host (project subdomain only — not a secret, public anyway)
 *   - Whether the service-role key parses as service_role JWT
 *   - First 6 / last 4 chars of the key (key-fingerprint, not the key
 *     itself — enough to compare across Vercel scopes without leaking
 *     the secret)
 *   - Total key length
 *   - A live SELECT against `agent_profiles` (count only) to prove the
 *     client actually has service-role privileges
 *
 * Usage (env-only, no auth needed):
 *   curl https://<deploy-url>/api/agent/intelligence/health
 *
 * Usage (full per-user check, logged in as the agent):
 *   curl -b cookies.txt https://<deploy-url>/api/agent/intelligence/health
 */
export async function GET(_request: NextRequest) {
  const startTime = Date.now();

  // ----- ENV BLOCK -----
  const envBlock = describeEnvironment();

  // 1. Service-role client construction.
  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        stage: 'service_role_client',
        env: envBlock,
        error: err?.message || String(err),
        verdict:
          'SUPABASE_SERVICE_ROLE_KEY is missing or wrong on this Vercel environment. ' +
          'Fix in Vercel dashboard → Settings → Environment Variables, then redeploy.',
        latencyMs: Date.now() - startTime,
      },
      { status: 500 },
    );
  }

  // 2. Live service-role probe — confirms the JWT is actually accepted by
  //    PostgREST as service_role (not anon). Counts agent_profiles rows;
  //    no PII. If count > 0 and the env-block says role=service_role we
  //    know the chat path's data layer is healthy.
  let serviceRoleProbe: { ok: boolean; profileCount: number | null; assignmentCount: number | null; error?: string } = {
    ok: false,
    profileCount: null,
    assignmentCount: null,
  };
  try {
    const [profilesRes, asaRes] = await Promise.all([
      supabase.from('agent_profiles').select('id', { count: 'exact', head: true }),
      supabase
        .from('agent_scheme_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),
    ]);
    serviceRoleProbe = {
      ok: !profilesRes.error && !asaRes.error,
      profileCount: profilesRes.count ?? null,
      assignmentCount: asaRes.count ?? null,
      error: profilesRes.error?.message || asaRes.error?.message,
    };
  } catch (err: any) {
    serviceRoleProbe = { ok: false, profileCount: null, assignmentCount: null, error: err?.message || String(err) };
  }

  // ----- AUTH (optional) -----
  const cookieStore = cookies();
  const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
  const { data: { user } } = await supabaseAuth.auth.getUser();

  // Unauthenticated path: return ENV + service-role probe results, no
  // per-user data. Useful for the operator to compare a Preview deploy
  // against Production without logging in as a particular agent.
  if (!user) {
    const envOk = envBlock.serviceKeyRolePayload === 'service_role' && serviceRoleProbe.ok && (serviceRoleProbe.profileCount ?? 0) > 0;
    return NextResponse.json(
      {
        ok: envOk,
        stage: 'env_only',
        env: envBlock,
        serviceRoleProbe,
        verdict: envOk
          ? 'ENV OK. Service-role JWT accepted by PostgREST. Per-user check skipped (no auth cookie).'
          : verdictFromProbe(envBlock, serviceRoleProbe),
        latencyMs: Date.now() - startTime,
      },
      { status: envOk ? 200 : 500 },
    );
  }

  // ----- USER BLOCK -----
  let resolved: Awaited<ReturnType<typeof resolveAgentContext>>;
  try {
    resolved = await resolveAgentContext(supabase, user.id);
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        stage: 'resolve_agent_context',
        env: envBlock,
        serviceRoleProbe,
        error: err?.message || String(err),
        authUserId: user.id,
        verdict:
          'resolveAgentContext threw. If the message mentions ' +
          '"Assigned: (none)" failure mode, ENV is right but the per-user RLS path is broken. ' +
          'Check Supabase policies on agent_scheme_assignments.',
        latencyMs: Date.now() - startTime,
      },
      { status: 500 },
    );
  }

  if (!resolved) {
    return NextResponse.json(
      {
        ok: false,
        stage: 'resolve_agent_context',
        env: envBlock,
        serviceRoleProbe,
        error: 'resolveAgentContext returned null',
        authUserId: user.id,
        verdict:
          'No agent_profiles row matches this auth user, and the earliest-profile fallback found nothing either. ' +
          'Verify the agent_profiles seed data for this Supabase project.',
        latencyMs: Date.now() - startTime,
      },
      { status: 500 },
    );
  }

  const probe = await supabase
    .from('agent_scheme_assignments')
    .select('development_id', { count: 'exact', head: true })
    .eq('agent_id', resolved.agentProfileId)
    .eq('is_active', true);

  const probeCount = probe.count ?? null;
  const resolvedCount = resolved.assignedDevelopmentIds.length;
  const matches = probeCount !== null && probeCount === resolvedCount;
  const ok = matches && resolvedCount > 0;

  return NextResponse.json(
    {
      ok,
      stage: 'complete',
      env: envBlock,
      serviceRoleProbe,
      latencyMs: Date.now() - startTime,
      authUserId: resolved.authUserId,
      agentProfileId: resolved.agentProfileId,
      tenantId: resolved.tenantId,
      displayName: resolved.displayName,
      assignedDevelopmentIds: resolved.assignedDevelopmentIds,
      assignedDevelopmentNames: resolved.assignedDevelopmentNames,
      assignmentCounts: {
        viaResolver: resolvedCount,
        viaServiceRoleProbe: probeCount,
        match: matches,
      },
      verdict: ok
        ? `OK — ${resolvedCount} assigned scheme(s), resolver and probe agree.`
        : !matches
          ? `MISMATCH — resolver returned ${resolvedCount} but service-role probe sees ${probeCount}. ` +
            `RLS is filtering rows from the resolver path. Verify SUPABASE_SERVICE_ROLE_KEY value on this Vercel scope.`
          : `EMPTY — resolver and probe agree at 0 assignments. Either the agent genuinely has none, or the seed data is missing.`,
    },
    { status: ok ? 200 : 500 },
  );
}

interface EnvBlock {
  urlPresent: boolean;
  urlHost: string | null;
  urlScheme: string | null;
  serviceKeyPresent: boolean;
  serviceKeyLength: number | null;
  serviceKeyFingerprint: string | null;
  serviceKeyRolePayload: 'service_role' | 'anon' | 'unknown' | 'invalid_jwt' | null;
  serviceKeyIssuer: string | null;
  serviceKeyRefHost: string | null;
  vercelEnv: string | null;
  vercelRegion: string | null;
  vercelDeploymentId: string | null;
}

function describeEnvironment(): EnvBlock {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  let urlHost: string | null = null;
  let urlScheme: string | null = null;
  try {
    if (url) {
      const u = new URL(url);
      urlHost = u.host;
      urlScheme = u.protocol.replace(':', '');
    }
  } catch {
    /* swallow */
  }

  // JWT payload decode — same logic as getSupabaseAdmin's check, but
  // here we surface the values for diagnosis rather than throwing.
  let role: EnvBlock['serviceKeyRolePayload'] = key ? 'unknown' : null;
  let issuer: string | null = null;
  let refHost: string | null = null;
  if (key) {
    try {
      const payloadBase64 = key.split('.')[1];
      if (payloadBase64) {
        const padded = payloadBase64.padEnd(payloadBase64.length + ((4 - (payloadBase64.length % 4)) % 4), '=');
        const payloadJson = Buffer.from(padded, 'base64').toString('utf8');
        const payload = JSON.parse(payloadJson);
        role = payload?.role === 'service_role' || payload?.role === 'anon' ? payload.role : 'unknown';
        issuer = payload?.iss ?? null;
        refHost = payload?.ref ? `${payload.ref}.supabase.co` : null;
      } else {
        role = 'invalid_jwt';
      }
    } catch {
      role = 'invalid_jwt';
    }
  }

  // Fingerprint = first 6 + last 4 chars + length. Enough to compare
  // values across Vercel scopes without revealing the secret.
  const fingerprint = key.length >= 10 ? `${key.slice(0, 6)}…${key.slice(-4)}` : null;

  return {
    urlPresent: !!url,
    urlHost,
    urlScheme,
    serviceKeyPresent: !!key,
    serviceKeyLength: key ? key.length : null,
    serviceKeyFingerprint: fingerprint,
    serviceKeyRolePayload: role,
    serviceKeyIssuer: issuer,
    serviceKeyRefHost: refHost,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    vercelRegion: process.env.VERCEL_REGION ?? null,
    vercelDeploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
  };
}

function verdictFromProbe(env: EnvBlock, probe: { ok: boolean; profileCount: number | null; error?: string }): string {
  if (!env.serviceKeyPresent) {
    return 'SUPABASE_SERVICE_ROLE_KEY is not set on this Vercel scope. Add it and redeploy.';
  }
  if (env.serviceKeyRolePayload === 'invalid_jwt') {
    return 'SUPABASE_SERVICE_ROLE_KEY does not parse as a JWT. Re-paste the value from Supabase → Project Settings → API.';
  }
  if (env.serviceKeyRolePayload === 'anon') {
    return 'The anon key has been pasted into SUPABASE_SERVICE_ROLE_KEY. Replace with the service_role secret from Supabase.';
  }
  if (env.serviceKeyRolePayload === 'unknown') {
    return 'SUPABASE_SERVICE_ROLE_KEY is set but the role inside the JWT is neither service_role nor anon. Verify the value matches what Supabase shows under Project Settings → API.';
  }
  if (!probe.ok) {
    return `Service-role probe failed: ${probe.error || 'unknown error'}. Check Supabase project URL and key match.`;
  }
  if ((probe.profileCount ?? 0) === 0) {
    return 'Service-role client connected but agent_profiles is empty. Verify seed data on this Supabase project.';
  }
  return 'Unexpected: env looks healthy but verdict resolver flagged it. Inspect the response body for details.';
}
