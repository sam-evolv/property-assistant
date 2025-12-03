import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { units, developments, important_docs_agreements } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import { validateQRToken } from '@openhouse/api/qr-tokens';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, unitUid } = body;

    if (!token || !unitUid) {
      return NextResponse.json(
        { error: 'Token and unit UID are required' },
        { status: 400 }
      );
    }

    const payload = await validateQRToken(token);
    if (!payload || payload.unitUid !== unitUid) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const unit = await db
      .select({
        id: units.id,
        development_id: units.development_id,
        tenant_id: units.tenant_id,
      })
      .from(units)
      .where(eq(units.unit_uid, unitUid))
      .limit(1);

    if (!unit || unit.length === 0) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    const development = await db
      .select({
        important_docs_version: developments.important_docs_version,
      })
      .from(developments)
      .where(eq(developments.id, unit[0].development_id))
      .limit(1);

    if (!development || development.length === 0) {
      return NextResponse.json(
        { error: 'Development not found' },
        { status: 404 }
      );
    }

    const currentVersion = development[0].important_docs_version;
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await db.transaction(async (tx) => {
      await tx
        .update(units)
        .set({
          important_docs_agreed_version: currentVersion,
          important_docs_agreed_at: new Date(),
        })
        .where(eq(units.id, unit[0].id));

      await tx.insert(important_docs_agreements).values({
        unit_id: unit[0].id,
        development_id: unit[0].development_id,
        tenant_id: unit[0].tenant_id,
        important_docs_version: currentVersion,
        agreed_at: new Date(),
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: {},
      });
    });

    return NextResponse.json({
      success: true,
      agreedVersion: currentVersion,
      agreedAt: new Date(),
    });
  } catch (error) {
    console.error('[Important Docs Agreement API Error]:', error);
    return NextResponse.json(
      { error: 'Failed to record agreement' },
      { status: 500 }
    );
  }
}
