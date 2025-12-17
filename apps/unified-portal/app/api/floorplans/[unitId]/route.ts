export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { units, houseTypes } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import { getServerSession } from '@/lib/supabase-server';
import { validateQRToken } from '@openhouse/api/qr-tokens';
import { getFloorplanSignedUrl } from '@openhouse/api/floorplan-storage';

export async function GET(
  request: NextRequest,
  { params }: { params: { unitId: string } }
) {
  try {
    const { unitId } = params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');

    let authorizedTenantId: string | null = null;
    let authorizedDevelopmentId: string | null = null;

    const session = await getServerSession();
    
    if (session) {
      authorizedTenantId = session.tenantId;
    } else if (token && unitUid) {
      const payload = await validateQRToken(token);
      if (!payload || payload.supabaseUnitId !== unitUid) {
        return NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 401 }
        );
      }
      
      const tokenUnit = await db.query.units.findFirst({
        where: eq(units.unit_uid, unitUid),
        columns: { development_id: true },
      });
      
      if (!tokenUnit) {
        return NextResponse.json(
          { error: 'Unit not found' },
          { status: 404 }
        );
      }
      
      authorizedDevelopmentId = tokenUnit.development_id;
    } else {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const unit = await db.query.units.findFirst({
      where: eq(units.id, unitId),
      with: {
        development: {
          with: {
            tenant: true,
          },
        },
      },
    });

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    if (authorizedTenantId) {
      if (session?.role !== 'super_admin' && unit.development?.tenant_id !== authorizedTenantId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    } else if (authorizedDevelopmentId) {
      if (unit.development_id !== authorizedDevelopmentId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    let dimensions: Record<string, any> | null = null;
    let floorplanUrl: string | null = null;
    let houseTypeCode: string | null = null;

    if (unit.house_type_code) {
      houseTypeCode = unit.house_type_code;
      
      const houseType = await db.query.houseTypes.findFirst({
        where: eq(houseTypes.house_type_code, unit.house_type_code),
        columns: { dimensions: true },
      });
      
      if (houseType?.dimensions) {
        dimensions = houseType.dimensions as Record<string, any>;
      } else {
        floorplanUrl = await getFloorplanSignedUrl(
          unit.development_id,
          unit.house_type_code
        );
      }
    }

    return NextResponse.json({
      unitId: unit.id,
      houseTypeCode,
      dimensions,
      floorplanUrl,
    });
  } catch (error) {
    console.error('[Floorplan by Unit API Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch floorplan data' },
      { status: 500 }
    );
  }
}
