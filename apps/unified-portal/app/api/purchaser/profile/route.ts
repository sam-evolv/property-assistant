import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';
import { validateQRToken } from '@openhouse/api/qr-tokens';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // Fetch unit from Supabase (same as resolve API)
    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select(`
        id, 
        project_id,
        unit_type_id,
        address,
        user_id,
        purchaser_name,
        handover_date,
        house_type,
        unit_types (
          name,
          floor_plan_pdf_url,
          specification_json
        ),
        projects (
          id,
          name,
          address,
          image_url,
          organization_id
        )
      `)
      .eq('id', unitUid)
      .single();

    if (unitError || !unit) {
      console.error('[Profile] Supabase unit lookup failed:', unitError?.message);
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const unitType = Array.isArray(unit.unit_types) ? unit.unit_types[0] : unit.unit_types;
    const project = Array.isArray(unit.projects) ? unit.projects[0] : unit.projects;

    // Try to get additional data from Drizzle homeowners table
    let homeownerData: any = null;
    try {
      const { rows: homeownerRows } = await db.execute(sql`
        SELECT name, address
        FROM homeowners
        WHERE unique_qr_token = ${unitUid}
        LIMIT 1
      `);
      if (homeownerRows && homeownerRows.length > 0) {
        homeownerData = homeownerRows[0];
      }
    } catch (e) {
      // Ignore - homeowner data is optional
    }

    // Try to get intel profile for BER rating
    let intelProfile: any = null;
    const houseTypeCode = unit.house_type || unitType?.name;
    if (project?.id && houseTypeCode) {
      try {
        const { rows: intelRows } = await db.execute(sql`
          SELECT 
            floor_area_total_sqm,
            ber_rating,
            rooms
          FROM unit_intelligence_profiles
          WHERE development_id = ${project.id}
            AND house_type_code = ${houseTypeCode}
            AND is_current = true
          ORDER BY version DESC
          LIMIT 1
        `);
        if (intelRows && intelRows.length > 0) {
          intelProfile = intelRows[0];
        }
      } catch (e) {
        // Ignore - intel profile is optional
      }
    }

    // Try to get unit-specific documents (floor plans, elevations)
    let documents: any[] = [];
    if (project?.id) {
      try {
        const { rows: docRows } = await db.execute(sql`
          SELECT 
            id,
            title,
            file_url,
            mime_type,
            metadata
          FROM documents
          WHERE development_id = ${project.id}
            AND is_superseded = false
            AND (
              LOWER(title) LIKE '%floor%plan%'
              OR LOWER(title) LIKE '%elevation%'
              OR LOWER(title) LIKE '%layout%'
              OR LOWER(title) LIKE '%site%plan%'
              OR metadata->>'category' = 'floorplans'
              OR metadata->>'category' = 'Floorplans'
            )
          ORDER BY created_at DESC
          LIMIT 10
        `);
        documents = (docRows || []).map((doc: any) => ({
          id: doc.id,
          title: doc.title,
          file_url: doc.file_url,
          mime_type: doc.mime_type,
          category: doc.metadata?.category || 'Floor Plans',
        }));
      } catch (e) {
        // Ignore - documents are optional
      }
    }

    // If we have a floor plan URL from unit_types, add it
    if (unitType?.floor_plan_pdf_url && documents.length === 0) {
      documents.push({
        id: 'unit-type-floorplan',
        title: `${unitType.name || 'Unit'} Floor Plan`,
        file_url: unitType.floor_plan_pdf_url,
        mime_type: 'application/pdf',
        category: 'Floor Plans',
      });
    }

    // Build the response
    const purchaserName = (homeownerData as any)?.name || unit.purchaser_name || 'Homeowner';
    const fullAddress = (homeownerData as any)?.address || unit.address || project?.address || 'Address not available';

    const profile = {
      unit: {
        id: unit.id,
        unit_uid: unit.id,
        address: fullAddress,
        eircode: null,
        house_type_code: houseTypeCode,
        house_type_name: unitType?.name || houseTypeCode || 'Your Home',
        bedrooms: null,
        bathrooms: null,
        floor_area_sqm: intelProfile?.floor_area_total_sqm ? parseFloat(intelProfile.floor_area_total_sqm) : null,
      },
      development: {
        id: project?.id,
        name: project?.name || 'Your Development',
        address: project?.address,
      },
      purchaser: {
        name: purchaserName,
      },
      intel: intelProfile ? {
        ber_rating: intelProfile.ber_rating,
        rooms: intelProfile.rooms,
      } : null,
      documents: documents,
    };

    return NextResponse.json(profile);
  } catch (error) {
    console.error('[Purchaser Profile Error]:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}
