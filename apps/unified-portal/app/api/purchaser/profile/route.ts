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

    // Fetch unit from Supabase with full details
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
        unit_types (
          name,
          floor_plan_pdf_url,
          specification_json,
          bedrooms,
          bathrooms,
          floor_area
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
    const houseTypeCode = unitType?.name;

    // Parse specification_json for additional details
    let specs: any = {};
    if (unitType?.specification_json) {
      try {
        specs = typeof unitType.specification_json === 'string' 
          ? JSON.parse(unitType.specification_json) 
          : unitType.specification_json;
      } catch (e) {
        // Ignore parse errors
      }
    }

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

    // Try to get intel profile for BER rating and additional details
    let intelProfile: any = null;
    if (houseTypeCode) {
      try {
        const { rows: intelRows } = await db.execute(sql`
          SELECT 
            floor_area_total_sqm,
            ber_rating,
            rooms,
            heating,
            hvac,
            suppliers
          FROM unit_intelligence_profiles
          WHERE house_type_code = ${houseTypeCode}
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

    // Get documents by house_type_code OR containing the house type code in title
    let documents: any[] = [];
    if (houseTypeCode) {
      try {
        const houseTypePattern = `%${houseTypeCode}%`;
        const { rows: docRows } = await db.execute(sql`
          SELECT 
            id,
            title,
            file_url,
            mime_type,
            document_type,
            discipline,
            metadata
          FROM documents
          WHERE is_superseded = false
            AND (
              house_type_code = ${houseTypeCode}
              OR UPPER(title) LIKE UPPER(${houseTypePattern})
              OR UPPER(file_name) LIKE UPPER(${houseTypePattern})
            )
          ORDER BY 
            CASE 
              WHEN house_type_code = ${houseTypeCode} THEN 0 
              ELSE 1 
            END,
            created_at DESC
          LIMIT 20
        `);
        documents = (docRows || []).map((doc: any) => ({
          id: doc.id,
          title: doc.title,
          file_url: doc.file_url,
          mime_type: doc.mime_type || 'application/pdf',
          category: getCategoryFromDoc(doc),
        }));
      } catch (e) {
        console.error('[Profile] Error fetching documents:', e);
      }
    }

    // If we have a floor plan URL from unit_types, add it if not already present
    if (unitType?.floor_plan_pdf_url) {
      const existingFloorPlan = documents.find(d => 
        d.file_url === unitType.floor_plan_pdf_url || 
        d.title?.toLowerCase().includes('floor plan')
      );
      if (!existingFloorPlan) {
        documents.unshift({
          id: 'unit-type-floorplan',
          title: `${unitType.name || 'Unit'} Floor Plan`,
          file_url: unitType.floor_plan_pdf_url,
          mime_type: 'application/pdf',
          category: 'Floor Plans',
        });
      }
    }

    // Build the response with all available details
    const purchaserName = (homeownerData as any)?.name || unit.purchaser_name || 'Homeowner';
    const fullAddress = (homeownerData as any)?.address || unit.address || project?.address || 'Address not available';

    // Get bedrooms/bathrooms from multiple sources
    const bedrooms = unitType?.bedrooms || specs?.bedrooms || intelProfile?.rooms?.bedrooms || null;
    const bathrooms = unitType?.bathrooms || specs?.bathrooms || intelProfile?.rooms?.bathrooms || null;
    const floorArea = unitType?.floor_area || intelProfile?.floor_area_total_sqm || specs?.floor_area || null;

    const profile = {
      unit: {
        id: unit.id,
        unit_uid: unit.id,
        address: fullAddress,
        eircode: specs?.eircode || null,
        house_type_code: houseTypeCode,
        house_type_name: unitType?.name || houseTypeCode || 'Your Home',
        bedrooms: bedrooms,
        bathrooms: bathrooms,
        floor_area_sqm: floorArea ? parseFloat(floorArea) : null,
        handover_date: unit.handover_date,
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
        heating: intelProfile.heating,
        hvac: intelProfile.hvac,
        suppliers: intelProfile.suppliers,
      } : null,
      specifications: Object.keys(specs).length > 0 ? specs : null,
      documents: documents,
    };

    return NextResponse.json(profile);
  } catch (error) {
    console.error('[Purchaser Profile Error]:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

function getCategoryFromDoc(doc: any): string {
  const title = (doc.title || '').toLowerCase();
  const docType = (doc.document_type || '').toLowerCase();
  const discipline = (doc.discipline || '').toLowerCase();
  
  if (title.includes('floor') || title.includes('plan') || docType === 'architectural') {
    return 'Floor Plans';
  }
  if (title.includes('elevation')) {
    return 'Elevations';
  }
  if (title.includes('specification') || title.includes('spec')) {
    return 'Specifications';
  }
  if (discipline === 'plumbing' || title.includes('plumb') || title.includes('sanit')) {
    return 'Plumbing';
  }
  if (discipline === 'electrical' || title.includes('electr')) {
    return 'Electrical';
  }
  if (title.includes('roof') || title.includes('tile')) {
    return 'Roofing';
  }
  return 'Documents';
}
