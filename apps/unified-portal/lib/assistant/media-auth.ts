/**
 * Tenant verification for Assistant V2 media routes.
 *
 * Four caller paths are supported. They are evaluated in this order and
 * each is named below so a future reader does not have to reverse-engineer
 * the control flow.
 *
 * Path A:  signed QR token             (Sprint 1, homeowner)
 * Path A': purchaser unit-uid token    (Sprint 1, homeowner / showhouse)
 * Path B:  admins session              (Sprint 1, developer portal admins)
 * Path C:  site_team_members session   (Sprint 2, builder-side snaggers)
 *
 * ====  Path A: signed QR token  ====
 * The caller sends `x-qr-token` and the token is a cryptographically valid
 * signed QR token (see packages/api/src/qr-tokens.ts). The unit id is
 * authoritative because it comes from the signed payload. If the request
 * body also supplies a `unit_id`, it must match the token's unit; mismatch
 * is 403.
 *
 * ====  Path A': purchaser unit-uid capability  ====
 * The caller sends `x-qr-token` but it is NOT a signed token. We accept
 * the unit UUID itself as the credential, matching the trust model the
 * production text-only chat already uses (apps/unified-portal/app/api/
 * chat/route.ts, lines 1685 onward: validate the signed token first, then
 * fall back to `clientUnitUid`). The unit UUID is an unguessable v4 UUID,
 * so possession of it is the capability.
 *
 * To match validatePurchaserToken's allow-list exactly (packages/api/src/
 * qr-tokens.ts:244), we accept the token in one of two shapes:
 *   - `<unit_uuid>`                              showhouse / continued session
 *   - `<unit_uuid>:<projectId>:<ts>:<nonce>:<sig>`  expired-but-issued token
 *
 * If the request body supplied a `unit_id`, the token shape must match
 * that exact unit. Mismatch is 403. If the request did not supply a
 * `unit_id`, the unit id is extracted from the token itself (the entire
 * token if it has no colon, or the segment before the first colon
 * otherwise). The extracted candidate is then looked up in the units
 * table; a non-existent unit is 404, not 401, so REST semantics do not
 * leak existence.
 *
 * Tenant_id and development_id always come from the units row, never from
 * the client, regardless of which path resolves the caller.
 *
 * ====  Path B: admins session (developer portal)  ====
 * No `x-qr-token` header. We resolve the caller via the Supabase session
 * cookie and look them up in the `admins` table (installer / developer /
 * super_admin). Tenant comes from the admins row. If a `unit_id` was
 * supplied, it must belong to that tenant; mismatch is 403.
 *
 * ====  Path C: site_team_members session (builder-side, Sprint 2)  ====
 * No `x-qr-token` header AND no admins row. The user is authenticated
 * via the same Supabase session cookie, but their identity for builder
 * routes lives in `site_team_members` instead of `admins`. This is the
 * path used by site team staff and accepted external snaggers when they
 * upload photos for /api/snag/create. Tenant comes from the membership
 * row. For role 'snagger_external' we also enforce the membership's
 * `expires_at`, and any supplied unit_id must belong to a development
 * in the membership's `development_ids` (null means all developments in
 * the tenant, used by 'admin' and 'site_team'). Sprint 1 callers never
 * reach this path because they either send `x-qr-token` (Path A or A')
 * or have an admins row (Path B).
 *
 * Cross-tenant enforcement on the media row itself (media.tenant_id !==
 * caller.tenant_id) stays in the signed-url route. This helper only
 * resolves who the caller is.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateQRToken } from '@openhouse/api/qr-tokens';
import { getSupabaseAdmin, getServerSession, createServerSupabaseClient } from '@/lib/supabase-server';
import type { AdminSession } from '@/lib/supabase-server';

export type MediaCallerType = 'homeowner' | 'admin' | 'snag';

export interface MediaAuthContext {
  callerType: MediaCallerType;
  tenantId: string;
  developmentId: string | null;
  unitId: string | null;
  userId: string | null;
  adminSession: AdminSession | null;
}

export type MediaAuthErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid_unit'
  | 'cross_tenant_unit';

export class MediaAuthError extends Error {
  constructor(public code: MediaAuthErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'MediaAuthError';
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface UnitRow {
  id: string;
  tenant_id: string | null;
  development_id: string | null;
}

async function loadUnit(unitId: string): Promise<UnitRow | null> {
  if (!UUID_RE.test(unitId)) return null;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('units')
    .select('id, tenant_id, development_id')
    .eq('id', unitId)
    .maybeSingle();
  if (error || !data) return null;
  return data as UnitRow;
}

/**
 * For Path A' only. The token is the raw unit UUID, or a colon-delimited
 * structure whose first segment is the unit UUID. Both shapes are accepted
 * by validatePurchaserToken (qr-tokens.ts:244) and by /api/chat in
 * practice. Returns the candidate unit id, or null if the token cannot
 * be interpreted as a purchaser capability.
 */
function extractPurchaserCandidate(token: string): string | null {
  if (UUID_RE.test(token)) return token;
  if (token.includes(':')) {
    const first = token.split(':')[0];
    if (UUID_RE.test(first)) return first;
  }
  return null;
}

/**
 * Resolve and verify the caller. If a unit_id is provided, the returned
 * context's tenant_id and development_id are taken from the unit (cross
 * checked against the caller's verified tenant). If no unit_id is given,
 * tenant_id falls back to the caller's verified tenant and development_id
 * is null on the admin path; on the homeowner path the unit id is
 * extracted from the QR token itself.
 *
 * Throws MediaAuthError; the route should convert to a response via
 * mediaAuthErrorToResponse.
 */
export async function resolveMediaAuth(
  request: NextRequest,
  opts: { unitId?: string | null; requireUnit?: boolean } = {},
): Promise<MediaAuthContext> {
  const { unitId: requestedUnitId = null, requireUnit = false } = opts;

  if (requestedUnitId && !UUID_RE.test(requestedUnitId)) {
    throw new MediaAuthError('invalid_unit');
  }

  const qrToken = request.headers.get('x-qr-token');

  if (qrToken) {
    // ====  Path A: signed QR token  ====
    const signedPayload = await validateQRToken(qrToken).catch(() => null);
    let candidateUnitId: string | null = null;

    if (signedPayload?.supabaseUnitId) {
      candidateUnitId = signedPayload.supabaseUnitId;
    } else {
      // ====  Path A': purchaser unit-uid capability  ====
      // Token is not a signed JWT-style token. Treat it as a unit
      // capability per the trust model used by /api/chat. If the request
      // also supplied a unit_id, that unit must match the token shape
      // (token === unit_id OR token starts with `unit_id:`). If no
      // unit_id was supplied, extract the candidate from the token
      // itself; this lets the signed-url route work for homeowners
      // whose token has not been refreshed and who only supply
      // media_id.
      if (requestedUnitId) {
        const tokenMatchesUnit =
          qrToken === requestedUnitId ||
          (qrToken.includes(':') && qrToken.split(':')[0] === requestedUnitId);
        if (!tokenMatchesUnit) {
          throw new MediaAuthError('unauthenticated');
        }
        candidateUnitId = requestedUnitId;
      } else {
        candidateUnitId = extractPurchaserCandidate(qrToken);
        if (!candidateUnitId) {
          throw new MediaAuthError('unauthenticated');
        }
      }
    }

    // Common tail for both A and A'. Tenant and development come from
    // the units row, never from the client.
    if (requestedUnitId && requestedUnitId !== candidateUnitId) {
      throw new MediaAuthError('cross_tenant_unit');
    }
    const unit = await loadUnit(candidateUnitId);
    if (!unit || !unit.tenant_id) {
      // Non-existent unit returns 404 via mediaAuthErrorToResponse,
      // not 401, so REST semantics do not leak existence by contrast.
      throw new MediaAuthError('invalid_unit');
    }
    return {
      callerType: 'homeowner',
      tenantId: unit.tenant_id,
      developmentId: unit.development_id,
      unitId: unit.id,
      userId: null,
      adminSession: null,
    };
  }

  // ====  Path B: admins session (developer portal)  ====
  const session = await getServerSession();
  if (session) {
    if (!session.tenantId) {
      throw new MediaAuthError('forbidden');
    }

    if (!requestedUnitId) {
      if (requireUnit) {
        throw new MediaAuthError('invalid_unit');
      }
      return {
        callerType: 'admin',
        tenantId: session.tenantId,
        developmentId: null,
        unitId: null,
        userId: session.id,
        adminSession: session,
      };
    }

    const unit = await loadUnit(requestedUnitId);
    if (!unit || !unit.tenant_id) {
      throw new MediaAuthError('invalid_unit');
    }
    if (unit.tenant_id !== session.tenantId) {
      throw new MediaAuthError('cross_tenant_unit');
    }

    return {
      callerType: 'admin',
      tenantId: unit.tenant_id,
      developmentId: unit.development_id,
      unitId: unit.id,
      userId: session.id,
      adminSession: session,
    };
  }

  // ====  Path C: site_team_members session (builder-side, Sprint 2)  ====
  // getServerSession returned null. That can mean either no Supabase
  // session at all, or a session whose user is not in the admins table.
  // The Sprint 2 snag UI is the second case: the user is signed in via
  // Supabase but their identity for builder routes lives in
  // site_team_members. We try that lookup before failing.
  const supabaseSsr = await createServerSupabaseClient();
  const { data: { user: snagUser } } = await supabaseSsr.auth.getUser();
  if (!snagUser?.id) {
    throw new MediaAuthError('unauthenticated');
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: memberRows, error: memberErr } = await supabaseAdmin
    .from('site_team_members')
    .select('id, tenant_id, role, development_ids, active, expires_at')
    .eq('user_id', snagUser.id)
    .eq('active', true)
    .order('invited_at', { ascending: true });

  if (memberErr) {
    console.error('[media-auth] site_team_members_lookup_failed reason=%s', memberErr.message);
    throw new MediaAuthError('unauthenticated');
  }
  if (!memberRows || memberRows.length === 0) {
    throw new MediaAuthError('unauthenticated');
  }

  const nowMs = Date.now();
  const membership = memberRows.find((r) => {
    if (r.role === 'snagger_external' && r.expires_at) {
      return new Date(r.expires_at as string).getTime() > nowMs;
    }
    return true;
  });
  if (!membership) {
    throw new MediaAuthError('forbidden');
  }

  if (!requestedUnitId) {
    if (requireUnit) {
      throw new MediaAuthError('invalid_unit');
    }
    return {
      callerType: 'snag',
      tenantId: membership.tenant_id as string,
      developmentId: null,
      unitId: null,
      userId: snagUser.id,
      adminSession: null,
    };
  }

  const snagUnit = await loadUnit(requestedUnitId);
  if (!snagUnit || !snagUnit.tenant_id) {
    throw new MediaAuthError('invalid_unit');
  }
  if (snagUnit.tenant_id !== membership.tenant_id) {
    throw new MediaAuthError('cross_tenant_unit');
  }

  if (membership.role === 'snagger_external') {
    const scope = Array.isArray(membership.development_ids) ? (membership.development_ids as string[]) : [];
    if (!snagUnit.development_id || !scope.includes(snagUnit.development_id)) {
      throw new MediaAuthError('cross_tenant_unit');
    }
  }

  return {
    callerType: 'snag',
    tenantId: snagUnit.tenant_id,
    developmentId: snagUnit.development_id,
    unitId: snagUnit.id,
    userId: snagUser.id,
    adminSession: null,
  };
}

/**
 * Map a MediaAuthError to a NextResponse. Cross-tenant attempts are
 * surfaced as 403 (not 404) because the spec's acceptance criteria
 * require an explicit 403 to confirm tenant isolation. Non-existent
 * units surface as 404 so the response distinguishes "I do not know
 * who you are" from "I know who you are but that unit does not exist".
 */
export function mediaAuthErrorToResponse(err: MediaAuthError): NextResponse {
  if (err.code === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (err.code === 'invalid_unit') {
    return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/**
 * Return a fresh 404 NextResponse when the feature flag is off. Routes
 * call this as the very first line so the surface area of the disabled
 * feature is exactly zero (no parse, no auth, no DB).
 */
export function featureDisabledResponse(): NextResponse {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
