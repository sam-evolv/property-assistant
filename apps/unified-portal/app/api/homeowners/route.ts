export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, isDeveloper, isSuperAdmin, canAccessDevelopment } from '@openhouse/api/session';
import { db } from '@openhouse/db/client';
import { homeowners, developments, messages, purchaserAgreements } from '@openhouse/db/schema';
import { eq, and, inArray, sql, desc } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { nanoid } from 'nanoid';

export const runtime = 'nodejs';

function generateRequestId(): string {
  return `ho-${nanoid(12)}`;
}

function errorResponse(error: string, status: number, requestId: string, details?: string) {
  console.error(`[HOMEOWNERS][${requestId}] Error (${status}): ${error}${details ? ` - ${details}` : ''}`);
  return NextResponse.json(
    { error, requestId, details },
    { 
      status, 
      headers: { 'x-request-id': requestId } 
    }
  );
}

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
      const homeownerToUnitMap = new Map<string, string>();
      const supabaseUnitIds: string[] = [];
      
      for (const h of homeownersList) {
        const unitId = extractSupabaseUnitId(h.email);
        if (unitId) {
          homeownerToUnitMap.set(h.id, unitId);
          supabaseUnitIds.push(unitId);
        } else {
          homeownerToUnitMap.set(h.id, h.id);
          supabaseUnitIds.push(h.id);
        }
      }

      const [messageStats, acknowledgementStats] = await Promise.all([
        supabaseUnitIds.length > 0 ? db.execute(sql`
          SELECT 
            user_id,
            COUNT(*)::int as message_count,
            MAX(created_at) as last_activity
          FROM messages
          WHERE user_id = ANY(${supabaseUnitIds})
          GROUP BY user_id
        `) : { rows: [] },
        supabaseUnitIds.length > 0 ? db.execute(sql`
          SELECT DISTINCT unit_id
          FROM purchaser_agreements
          WHERE unit_id = ANY(${supabaseUnitIds})
        `) : { rows: [] },
      ]);

      const messageMap = new Map<string, { message_count: number; last_activity: string | null }>();
      for (const row of messageStats.rows as any[]) {
        messageMap.set(row.user_id, {
          message_count: row.message_count || 0,
          last_activity: row.last_activity,
        });
      }

      const acknowledgedUnits = new Set(
        (acknowledgementStats.rows as any[] || []).map(a => a.unit_id)
      );

      homeownersList = homeownersList.map(h => {
        const unitId = homeownerToUnitMap.get(h.id);
        const stats = unitId ? messageMap.get(unitId) : null;
        const hasAcknowledged = unitId ? acknowledgedUnits.has(unitId) : false;
        
        return {
          ...h,
          message_count: stats?.message_count || 0,
          last_activity: stats?.last_activity || null,
          has_acknowledged: hasAcknowledged,
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
  const requestId = generateRequestId();
  
  try {
    const adminContext = await getAdminSession();
    
    if (!adminContext) {
      return errorResponse('Unauthorised. Please log in.', 401, requestId);
    }

    let body: any;
    try {
      body = await request.json();
    } catch (parseError) {
      return errorResponse('Invalid request body', 400, requestId, 'Could not parse JSON');
    }
    
    const { developmentId, name, email, houseType, address } = body;

    if (!developmentId) {
      return errorResponse('Development is required', 400, requestId, 'Missing developmentId field');
    }
    
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return errorResponse('Name is required (minimum 2 characters)', 400, requestId, 'Invalid name field');
    }

    const hasAccess = await canAccessDevelopment(adminContext, developmentId);
    if (!hasAccess) {
      return errorResponse('Access denied to this development', 403, requestId, `User ${adminContext.email} cannot access development ${developmentId}`);
    }

    const development = await db.query.developments.findFirst({
      where: eq(developments.id, developmentId),
      columns: {
        id: true,
        tenant_id: true,
        name: true,
      },
    });

    if (!development) {
      return errorResponse('Development not found', 404, requestId, `No development with ID ${developmentId}`);
    }

    const uniqueQrToken = randomBytes(16).toString('hex');
    const cleanName = name.trim();

    const [homeowner] = await db
      .insert(homeowners)
      .values({
        tenant_id: development.tenant_id,
        development_id: developmentId,
        name: cleanName,
        email: email || '',
        house_type: houseType || null,
        address: address || null,
        unique_qr_token: uniqueQrToken,
      })
      .returning();

    console.log(`[HOMEOWNERS][${requestId}] Created: ${cleanName} for development ${development.name} (${developmentId})`);

    return NextResponse.json(
      { homeowner, requestId }, 
      { 
        status: 201,
        headers: { 'x-request-id': requestId }
      }
    );
  } catch (error: any) {
    const errorMsg = error?.message || 'Unknown error';
    const errorCode = error?.code || 'UNKNOWN';
    
    if (errorCode === '23505') {
      return errorResponse('A homeowner with these details already exists', 409, requestId, 'Duplicate entry');
    }
    
    return errorResponse('Failed to create homeowner', 500, requestId, errorMsg);
  }
}
