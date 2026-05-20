/**
 * Tenant verification for Assistant V2 media routes (Sprint 1).
 *
 * Two caller types are supported and must be told apart from the request
 * itself. Never trust a client-supplied tenant_id.
 *
 * 1. Homeowner (resident). Authenticates with an x-qr-token header. We
 *    validate the signed QR token, derive the units.id from it, then look
 *    up tenant_id and development_id from the units row. The caller-supplied
 *    unit_id (if any) must match the token-bound unit, otherwise 403.
 *
 * 2. Installer / developer / admin. Authenticates with a Supabase admin
 *    session cookie. We resolve tenant_id from the admins row. The caller-
 *    supplied unit_id (if any) must belong to that tenant, otherwise 403.
 *
 * Both code paths return the same MediaAuthContext shape so route handlers
 * stay short. Routes that need a unit_id (uploads, multimodal chat) ask
 * for it explicitly; routes that don't (signed-url) skip the unit check.
 *
 * This is deliberately a thin, additive helper. It does not replace the
 * existing care-session or admin-session helpers. It exists because the
 * three new assistant routes need a single auth boundary that handles both
 * homeowner and admin callers, and embedding that logic in each route
 * would invite drift.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateQRToken } from '@openhouse/api/qr-tokens';
import { getSupabaseAdmin, getServerSession } from '@/lib/supabase-server';
import type { AdminSession } from '@/lib/supabase-server';

export type MediaCallerType = 'homeowner' | 'admin';

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
 * Resolve and verify the caller. If a unit_id is provided, the returned
 * context's tenant_id and development_id are taken from the unit (cross-
 * checked against the caller's verified tenant). If no unit_id is given,
 * tenant_id falls back to the caller's verified tenant and development_id
 * is null.
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
    const payload = await validateQRToken(qrToken).catch(() => null);
    if (!payload?.supabaseUnitId) {
      throw new MediaAuthError('unauthenticated');
    }

    const unit = await loadUnit(payload.supabaseUnitId);
    if (!unit || !unit.tenant_id) {
      throw new MediaAuthError('invalid_unit');
    }

    if (requestedUnitId && requestedUnitId !== unit.id) {
      throw new MediaAuthError('cross_tenant_unit');
    }

    if (requireUnit && !unit.id) {
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

  const session = await getServerSession();
  if (!session) {
    throw new MediaAuthError('unauthenticated');
  }
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

/**
 * Map a MediaAuthError to a NextResponse. Cross-tenant attempts are
 * surfaced as 403 (not 404) because the spec's acceptance criteria
 * require an explicit 403 to confirm tenant isolation.
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
