import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, isDeveloper, isSuperAdmin, canAccessDevelopment } from '@openhouse/api/session';
import { db } from '@openhouse/db/client';
import { homeowners, developments } from '@openhouse/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const qrToken = searchParams.get('qrToken');
    const developmentId = searchParams.get('developmentId');

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
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let homeownersList;

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
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { developmentId, name, email, houseType, address } = body;

    if (!developmentId || !name || !email) {
      return NextResponse.json(
        { error: 'Development ID, name, and email are required' },
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
        email,
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
