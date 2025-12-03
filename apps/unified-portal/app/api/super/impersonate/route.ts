import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { db } from '@openhouse/db/client';
import { units, qr_tokens, admins } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import { signQRToken } from '@openhouse/api/qr-tokens';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser || !authUser.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is Super Admin (check admins table)
    const admin = await db.query.admins.findFirst({
      where: eq(admins.email, authUser.email),
      columns: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!admin || admin.role !== 'super_admin') {
      console.error('[Impersonation API] Unauthorized: User is not Super Admin');
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const unitUid = searchParams.get('unitUid');

    if (!unitUid) {
      return NextResponse.json({ error: 'Missing unitUid' }, { status: 400 });
    }

    // Verify unit exists and get details
    const unitData = await db
      .select({
        id: units.id,
        unit_uid: units.unit_uid,
        tenant_id: units.tenant_id,
        development_id: units.development_id,
      })
      .from(units)
      .where(eq(units.unit_uid, unitUid))
      .limit(1);

    if (!unitData || unitData.length === 0) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const unit = unitData[0];

    // Generate a QR token (valid for 1 hour for impersonation)
    // Note: We use signQRToken + manual insert to avoid invalidating homeowner tokens
    const { token, url, expiresAt } = signQRToken({
      unitId: unit.id,
      tenantId: unit.tenant_id,
      developmentId: unit.development_id,
      unitUid: unit.unit_uid,
    }, 1); // 1 hour expiry for Super Admin impersonation

    // Store token hash in database (without deleting existing homeowner tokens)
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    await db.insert(qr_tokens).values({
      unit_id: unit.id,
      tenant_id: unit.tenant_id,
      development_id: unit.development_id,
      token: null,  // Never store plaintext token
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_at: new Date(),
    });

    console.log(`[Super Admin Impersonation] Generated 1-hour impersonation token for unit ${unitUid}, expires at ${expiresAt.toISOString()}`);
    
    return NextResponse.json({ 
      token,
      url,
      unitUid: unit.unit_uid,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('[Impersonation API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
