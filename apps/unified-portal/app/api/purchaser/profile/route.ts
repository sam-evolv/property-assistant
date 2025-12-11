import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';
import { validateQRToken } from '@openhouse/api/qr-tokens';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');

    if (!unitUid) {
      return NextResponse.json({ error: 'Unit UID is required' }, { status: 400 });
    }

    // Validate token - require proper QR token validation for security
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 401 });
    }

    const payload = await validateQRToken(token);
    if (!payload || payload.supabaseUnitId !== unitUid) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Fetch unit details with development and intel profile data
    const { rows: unitRows } = await db.execute(sql`
      SELECT 
        u.id,
        u.unit_uid,
        u.unit_code,
        u.house_type_code,
        u.address,
        u.eircode,
        u.floor_area_m2,
        u.development_id,
        d.name as development_name,
        d.address as development_address,
        h.name as purchaser_name,
        h.id as homeowner_id,
        ht.name as house_type_name,
        ht.bedrooms,
        ht.bathrooms,
        ht.total_floor_area_sqm as house_type_floor_area
      FROM units u
      LEFT JOIN developments d ON u.development_id = d.id
      LEFT JOIN homeowners h ON h.unique_qr_token = u.unit_uid
      LEFT JOIN house_types ht ON ht.development_id = u.development_id AND ht.house_type_code = u.house_type_code
      WHERE u.unit_uid = ${unitUid}
      LIMIT 1
    `);

    if (!unitRows || unitRows.length === 0) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const unit = unitRows[0] as any;

    // Fetch intel profile for BER rating and additional data
    let intelProfile: any = null;
    if (unit.development_id && unit.house_type_code) {
      const { rows: intelRows } = await db.execute(sql`
        SELECT 
          floor_area_total_sqm,
          ber_rating,
          rooms,
          suppliers,
          hvac,
          metadata
        FROM unit_intelligence_profiles
        WHERE development_id = ${unit.development_id}
          AND house_type_code = ${unit.house_type_code}
          AND is_current = true
        ORDER BY version DESC
        LIMIT 1
      `);
      if (intelRows && intelRows.length > 0) {
        intelProfile = intelRows[0];
      }
    }

    // Fetch unit-specific documents (floor plans, elevations)
    const { rows: docRows } = await db.execute(sql`
      SELECT 
        id,
        title,
        file_url,
        mime_type,
        metadata,
        created_at
      FROM documents
      WHERE development_id = ${unit.development_id}
        AND is_superseded = false
        AND (
          house_type_code = ${unit.house_type_code}
          OR metadata->>'is_global' = 'true'
          OR metadata->'house_types' @> ${JSON.stringify([unit.house_type_code])}::jsonb
        )
        AND (
          LOWER(title) LIKE '%floor%plan%'
          OR LOWER(title) LIKE '%elevation%'
          OR LOWER(title) LIKE '%layout%'
          OR LOWER(title) LIKE '%site%plan%'
          OR metadata->>'category' = 'floorplans'
          OR metadata->>'category' = 'Floorplans'
        )
      ORDER BY 
        CASE WHEN LOWER(title) LIKE '%floor%plan%' THEN 1
             WHEN LOWER(title) LIKE '%elevation%' THEN 2
             WHEN LOWER(title) LIKE '%layout%' THEN 3
             ELSE 4
        END,
        created_at DESC
      LIMIT 10
    `);

    // Calculate floor area - prefer unit-specific, then intel profile, then house type
    const floorArea = unit.floor_area_m2 
      || intelProfile?.floor_area_total_sqm 
      || unit.house_type_floor_area
      || null;

    // Build response
    const profile = {
      unit: {
        id: unit.id,
        unit_uid: unit.unit_uid,
        unit_code: unit.unit_code,
        address: unit.address,
        eircode: unit.eircode,
        house_type_code: unit.house_type_code,
        house_type_name: unit.house_type_name || unit.house_type_code,
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
        floor_area_sqm: floorArea ? parseFloat(floorArea) : null,
      },
      development: {
        id: unit.development_id,
        name: unit.development_name,
        address: unit.development_address,
      },
      purchaser: {
        name: unit.purchaser_name || 'Homeowner',
      },
      intel: intelProfile ? {
        ber_rating: intelProfile.ber_rating,
        rooms: intelProfile.rooms,
        suppliers: intelProfile.suppliers,
      } : null,
      documents: (docRows || []).map((doc: any) => ({
        id: doc.id,
        title: doc.title,
        file_url: doc.file_url,
        mime_type: doc.mime_type,
        category: doc.metadata?.category || 'Floor Plans',
      })),
    };

    return NextResponse.json(profile);
  } catch (error) {
    console.error('[Purchaser Profile Error]:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}
