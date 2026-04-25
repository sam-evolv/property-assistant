import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { resolveAgentContext } from '@/lib/agent-intelligence/agent-context';
import { resolveAgentContextV2 } from '@/lib/agent-intelligence/resolve-agent-v2';

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

  // Session 14.5 — quad-shape probe. We've established (Session 14.4) that
  // resolver returns 0 while service-role probe returns 5 for the same
  // agent_id with the same client. To distinguish "shared client JWT
  // state mutates between calls" from "PostgREST handles different
  // SELECT shapes differently" from "supabase-js itself drops rows on
  // certain queries", run all four shapes here and report each.
  //
  // Crucially: also build a FRESH service-role client (separate from
  // getSupabaseAdmin's possibly-cached one) and run the same query —
  // if the fresh client returns 5 but the shared one returns 0, we
  // know the issue is client state.
  const sharedClient = supabase;
  const { createClient } = await import('@supabase/supabase-js');
  const freshClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const aid = resolved.agentProfileId;

  // Helper to run a query and return a normalized result line.
  type Probe = { name: string; client: 'shared' | 'fresh'; selected: string; head: boolean; count: number | null; rows: number | null; error: string | null };
  const probes: Probe[] = [];

  async function runProbe(name: string, client: typeof sharedClient, clientLabel: 'shared' | 'fresh', selected: string, head: boolean): Promise<void> {
    try {
      let q = client.from('agent_scheme_assignments').select(selected, head ? { count: 'exact', head: true } : { count: 'exact' });
      q = q.eq('agent_id', aid).eq('is_active', true);
      const res: any = await q;
      probes.push({
        name,
        client: clientLabel,
        selected,
        head,
        count: res.count ?? null,
        rows: head ? null : (Array.isArray(res.data) ? res.data.length : null),
        error: res.error ? `${res.error.code || ''}: ${res.error.message || ''}` : null,
      });
    } catch (err: any) {
      probes.push({ name, client: clientLabel, selected, head, count: null, rows: null, error: err?.message || String(err) });
    }
  }

  // 1. Shared client, head+count, single column 'id' (matches /health line 86 shape but agent-filtered)
  await runProbe('shared/head/id', sharedClient, 'shared', 'id', true);
  // 2. Shared client, head+count, single column 'development_id' (the per-user probe shape from before)
  await runProbe('shared/head/development_id', sharedClient, 'shared', 'development_id', true);
  // 3. Shared client, full SELECT, three columns (the resolver shape)
  await runProbe('shared/full/development_id,is_active,role', sharedClient, 'shared', 'development_id, is_active, role', false);
  // 4. Fresh client, full SELECT, three columns (compare: same query, separate client)
  await runProbe('fresh/full/development_id,is_active,role', freshClient, 'fresh', 'development_id, is_active, role', false);
  // 5. Fresh client, head+count (sanity)
  await runProbe('fresh/head/development_id', freshClient, 'fresh', 'development_id', true);

  // Re-resolve via the FRESH client to see if resolveAgentContext gives different counts there.
  let resolvedFresh: Awaited<ReturnType<typeof resolveAgentContext>> = null;
  let resolvedFreshError: string | null = null;
  try {
    resolvedFresh = await resolveAgentContext(freshClient, resolved.authUserId);
  } catch (err: any) {
    resolvedFreshError = err?.message || String(err);
  }

  // Session 14.6 — call the V2 resolver as well. If V2 returns the
  // correct 5 assignments while V1 returns 0, V2 is shippable as-is
  // and we can wire it into the chat route.
  let v2Result: Awaited<ReturnType<typeof resolveAgentContextV2>> | null = null;
  let v2Error: string | null = null;
  try {
    v2Result = await resolveAgentContextV2(sharedClient, resolved.authUserId);
  } catch (err: any) {
    v2Error = err?.message || String(err);
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
      probesQuadShape: probes,
      resolverViaFreshClient: {
        assignedDevelopmentIds: resolvedFresh?.assignedDevelopmentIds ?? null,
        assignedDevelopmentNames: resolvedFresh?.assignedDevelopmentNames ?? null,
        error: resolvedFreshError,
      },
      resolverV2: {
        agentProfileId: v2Result?.context?.agentProfileId ?? null,
        assignedDevelopmentIds: v2Result?.context?.assignedDevelopmentIds ?? null,
        assignedDevelopmentNames: v2Result?.context?.assignedDevelopmentNames ?? null,
        trace: v2Result?.trace ?? null,
        error: v2Error,
      },
      verdict: ok
        ? `OK — ${resolvedCount} assigned scheme(s), resolver and probe agree.`
        : !matches
          ? `MISMATCH — resolver returned ${resolvedCount} but service-role probe sees ${probeCount}. ` +
            `RLS is filtering rows from the resolver path. Inspect probesQuadShape and resolverViaFreshClient to identify the differentiating factor.`
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
