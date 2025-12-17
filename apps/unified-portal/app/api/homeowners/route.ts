export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, isDeveloper, isSuperAdmin, canAccessDevelopment } from '@openhouse/api/session';
import { db } from '@openhouse/db/client';
import { homeowners, developments, messages, purchaserAgreements } from '@openhouse/db/schema';
import { eq, and, inArray, sql, desc } from 'drizzle-orm';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';

function extractSupabaseUnitId(email: string | null): string | null {
  if (!email) return null;
  const match = email.match(/unit-([a-f0-9-]+)@/i);
  return match ? match[1] : null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const qrToken = searchParams.get('qrToken');
    const developmentId = searchParams.get('developmentId');
    const includeStats = searchParams.get('includeStats') === 'true';

    if (qrToken) {
      const homeowner = await db.query.homeowners.findFirst({
        where: eq(homeowners.unique_qr_token, qrToken),
        with: {
          development: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!homeowner) {
        return NextResponse.json(
          { error: 'Homeowner not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ homeowner });
    }

    const adminContext = await getAdminSession();
    
    if (!adminContext) {
      return NextResponse.json(
        { error: 'Unauthorised' },
        { status: 401 }
      );
    }

    let homeownersList: any[];

    if (developmentId) {
      const hasAccess = await canAccessDevelopment(adminContext, developmentId);
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied to this development' },
          { status: 403 }
        );
      }

      homeownersList = await db.query.homeowners.findMany({
        where: eq(homeowners.development_id, developmentId),
        with: {
          development: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });
    } else if (isSuperAdmin(adminContext)) {
      homeownersList = await db.query.homeowners.findMany({
        with: {
          development: {
            columns: {
              id: true,
              name: true,
            },
          },
          tenant: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });
    } else if (isDeveloper(adminContext)) {
      homeownersList = await db.query.homeowners.findMany({
        where: (homeowners, { inArray }) => 
          inArray(homeowners.development_id,
            db.select({ id: developments.id })
              .from(developments)
              .where(
                and(
                  eq(developments.developer_user_id, adminContext.id),
                  eq(developments.tenant_id, adminContext.tenantId)
                )
              )
          ),
        with: {
          development: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });
    } else {
      homeownersList = await db.query.homeowners.findMany({
        where: eq(homeowners.tenant_id, adminContext.tenantId),
      });
    }

    if (includeStats && homeownersList.length > 0) {
      const homeownerUnitMap = new Map<string, string>();
      const unitIds: string[] = [];
      
      for (const h of homeownersList) {
        const unitId = extractSupabaseUnitId(h.email);
        if (unitId) {
          homeownerUnitMap.set(h.id, unitId);
          unitIds.push(unitId);
        }
      }

      const [messageStats, acknowledgementStats] = await Promise.all([
        unitIds.length > 0 ? db.execute(sql`
          SELECT 
            user_id,
            COUNT(*)::int as message_count,
            MAX(created_at) as last_activity
          FROM messages
          WHERE user_id = ANY(${unitIds})
          GROUP BY user_id
        `) : { rows: [] },
        db.select({
          unit_id: purchaserAgreements.unit_id,
        })
        .from(purchaserAgreements)
        .groupBy(purchaserAgreements.unit_id),
      ]);

      const messageMap = new Map<string, { message_count: number; last_activity: string | null }>();
      for (const row of messageStats.rows as any[]) {
        messageMap.set(row.user_id, {
          message_count: row.message_count || 0,
          last_activity: row.last_activity,
        });
      }

      const acknowledgedUnits = new Set(acknowledgementStats.map(a => a.unit_id));

      homeownersList = homeownersList.map(h => {
        const unitId = homeownerUnitMap.get(h.id);
        return {
          ...h,
          message_count: unitId ? (messageMap.get(unitId)?.message_count || 0) : 0,
          last_activity: unitId ? (messageMap.get(unitId)?.last_activity || null) : null,
          has_acknowledged: unitId ? acknowledgedUnits.has(unitId) : false,
        };
      });
    }

    return NextResponse.json({ homeowners: homeownersList });
  } catch (error) {
    console.error('[HOMEOWNERS] Error fetching:', error);
    return NextResponse.json(
      { error: 'Failed to fetch homeowners' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminContext = await getAdminSession();
    
    if (!adminContext) {
      return NextResponse.json(
        { error: 'Unauthorised' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { developmentId, name, email, houseType, address } = body;

    if (!developmentId || !name) {
      return NextResponse.json(
        { error: 'Development ID and name are required' },
        { status: 400 }
      );
    }

    const hasAccess = await canAccessDevelopment(adminContext, developmentId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to this development' },
        { status: 403 }
      );
    }

    const development = await db.query.developments.findFirst({
      where: (developments, { eq }) => eq(developments.id, developmentId),
      columns: {
        id: true,
        tenant_id: true,
      },
    });

    if (!development) {
      return NextResponse.json(
        { error: 'Development not found' },
        { status: 404 }
      );
    }

    const uniqueQrToken = randomBytes(16).toString('hex');

    const [homeowner] = await db
      .insert(homeowners)
      .values({
        tenant_id: development.tenant_id,
        development_id: developmentId,
        name,
        email: email || '',
        house_type: houseType || null,
        address: address || null,
        unique_qr_token: uniqueQrToken,
      })
      .returning();

    console.log(`[HOMEOWNERS] Created: ${name} for development ${developmentId}`);

    return NextResponse.json({ homeowner }, { status: 201 });
  } catch (error) {
    console.error('[HOMEOWNERS] Error creating:', error);
    return NextResponse.json(
      { error: 'Failed to create homeowner' },
      { status: 500 }
    );
  }
}
