import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { houseTypes, units } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import { createServerSupabaseClient } from '@openhouse/api/supabase';
import { getServerSession } from '@/lib/supabase-server';
import { validateQRToken } from '@openhouse/api/qr-tokens';

export async function GET(
  request: NextRequest,
  { params }: { params: { houseTypeId: string } }
) {
  try {
    const { houseTypeId } = params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');

    let authorizedTenantId: string | null = null;
    let authorizedDevelopmentId: string | null = null;

    // Authentication: Either admin session OR purchaser token
    const session = await getServerSession();
    
    if (session) {
      // Admin/developer access - scoped to their tenant
      authorizedTenantId = session.tenantId;
    } else if (token && unitUid) {
      // Purchaser access via QR token
      const payload = await validateQRToken(token);
      if (!payload || payload.unitUid !== unitUid) {
        return NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 401 }
        );
      }
      
      // Get the unit to determine which development they can access
      const unit = await db.query.units.findFirst({
        where: eq(units.unit_uid, unitUid),
        columns: { development_id: true },
      });
      
      if (!unit) {
        return NextResponse.json(
          { error: 'Unit not found' },
          { status: 404 }
        );
      }
      
      authorizedDevelopmentId = unit.development_id;
    } else {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Fetch house type with development and tenant info
    const houseType = await db.query.houseTypes.findFirst({
      where: eq(houseTypes.id, houseTypeId),
      with: {
        development: {
          with: {
            tenant: true,
          },
        },
      },
    });

    if (!houseType) {
      return NextResponse.json({ error: 'House type not found' }, { status: 404 });
    }

    // Authorization check: Ensure user can access this house type
    if (authorizedTenantId) {
      // Admin must belong to the same tenant (super_admin can access all)
      if (session?.role !== 'super_admin' && houseType.development.tenant_id !== authorizedTenantId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    } else if (authorizedDevelopmentId) {
      // Purchaser must be accessing a house type from their development
      if (houseType.development_id !== authorizedDevelopmentId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    const tenantSlug = houseType.development.tenant.slug || houseType.development.tenant.id;
    const developmentSlug = houseType.development.slug || houseType.development.code;
    const houseTypeCode = houseType.house_type_code;

    // If dimensions exist, return them without generating a signed URL (cost optimization)
    if (houseType.dimensions && Object.keys(houseType.dimensions as object).length > 0) {
      return NextResponse.json({
        houseTypeId: houseType.id,
        houseTypeCode: houseType.house_type_code,
        name: houseType.name,
        dimensions: houseType.dimensions,
        floorplanUrl: null,
      });
    }

    // No dimensions - try to get floorplan URL
    const filePath = `floorplans/${tenantSlug}/${developmentSlug}/${houseTypeCode}.pdf`;
    let signedUrl: string | null = null;

    try {
      const supabase = createServerSupabaseClient();
      const { data, error } = await supabase
        .storage
        .from('floorplans')
        .createSignedUrl(filePath, 3600);

      if (data && !error) {
        signedUrl = data.signedUrl;
      }
    } catch (storageError) {
      console.log('[Floorplan] Storage not available or file not found:', storageError);
    }

    return NextResponse.json({
      houseTypeId: houseType.id,
      houseTypeCode: houseType.house_type_code,
      name: houseType.name,
      dimensions: null,
      floorplanUrl: signedUrl,
    });
  } catch (error) {
    console.error('[Floorplan API Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch floorplan data' },
      { status: 500 }
    );
  }
}
