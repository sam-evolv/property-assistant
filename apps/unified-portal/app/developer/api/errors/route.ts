import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getRecentErrors, getErrorStats } from '@openhouse/api';
import { db } from '@openhouse/db';
import { admins } from '@openhouse/db/schema';
import { eq, and, sql } from 'drizzle-orm';

async function validateDeveloperAccess(email: string, tenantId: string) {
  const admin = await db.query.admins.findFirst({
    where: and(
      eq(admins.email, email),
      eq(admins.tenant_id, tenantId)
    ),
    columns: { id: true, role: true }
  });

  if (!admin) {
    return { valid: false, adminId: null, error: 'Admin not found' };
  }

  return { valid: true, adminId: admin.id, role: admin.role };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const developmentId = searchParams.get('developmentId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const unresolvedOnly = searchParams.get('unresolvedOnly') === 'true';
    const errorType = searchParams.get('errorType') as any || undefined;

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const access = await validateDeveloperAccess(user.email, tenantId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const [errors, stats] = await Promise.all([
      getRecentErrors({ tenantId, developmentId, limit, unresolvedOnly, errorType }),
      getErrorStats(tenantId, 7)
    ]);

    return NextResponse.json({
      errors,
      stats,
      filters: { tenantId, developmentId, limit, unresolvedOnly, errorType }
    });

  } catch (error) {
    console.error('[Errors API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch errors' },
      { status: 500 }
    );
  }
}

// Mark error as resolved
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body = await request.json();
    const { errorId, tenantId, resolved } = body;

    if (!errorId || !tenantId) {
      return NextResponse.json({ error: 'errorId and tenantId are required' }, { status: 400 });
    }

    const access = await validateDeveloperAccess(user.email, tenantId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    await db.execute(sql`
      UPDATE error_logs
      SET 
        resolved = ${resolved !== false},
        resolved_at = ${resolved !== false ? sql`now()` : sql`NULL`},
        resolved_by = ${access.adminId ? sql`${access.adminId}::uuid` : sql`NULL`}
      WHERE id = ${errorId}::uuid
        AND tenant_id = ${tenantId}::uuid
    `);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Errors API] Error updating:', error);
    return NextResponse.json(
      { error: 'Failed to update error' },
      { status: 500 }
    );
  }
}
