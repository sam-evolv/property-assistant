import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';
import { validateQRToken } from '@openhouse/api/qr-tokens';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');

    if (!unitUid) {
      return NextResponse.json({ error: 'Unit UID is required' }, { status: 400 });
    }

    // Validate token - accept either proper QR token or unit ID directly
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 401 });
    }

    // Check if token is a valid UUID (unit ID) - allow direct unit ID access
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isDirectUnitId = uuidRegex.test(token) && token === unitUid;
    
    if (!isDirectUnitId) {
      // Try proper QR token validation
      const payload = await validateQRToken(token);
      if (!payload || payload.supabaseUnitId !== unitUid) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
      }
    }

    // Fetch unit from Drizzle database (check both id and unit_uid)
    const unitResult = await db.execute(sql`
      SELECT 
        u.id,
        u.unit_uid,
        u.development_id as project_id,
        u.house_type_code,
        u.address_line_1,
        u.address_line_2,
        u.city,
        u.eircode,
        u.purchaser_name,
        u.purchaser_email,
        u.purchaser_phone,
        u.mrpn,
        u.electricity_account,
        u.esb_eirgrid_number,
        u.latitude,
        u.longitude,
        u.bedrooms,
        u.bathrooms,
        d.id as dev_id,
        d.name as dev_name,
        d.address as dev_address,
        d.logo_url as dev_logo_url
      FROM units u
      LEFT JOIN developments d ON u.development_id = d.id
      WHERE u.id = ${unitUid}::uuid OR u.unit_uid = ${unitUid}
      LIMIT 1
    `);

    let unit = unitResult.rows[0] as any;

    // Fallback to Supabase units table if not found in Drizzle
    if (!unit) {
      console.log('[Profile] Not found in Drizzle, checking Supabase...');
      try {
        const supabase = getSupabaseClient();
        const { data: supabaseUnit, error } = await supabase
          .from('units')
          .select('id, address, purchaser_name, project_id')
          .eq('id', unitUid)
          .single();
        
        console.log('[Profile] Supabase query result:', supabaseUnit ? 'found' : 'not found', error ? `error: ${error.message}` : '');
        
        if (supabaseUnit && !error) {
          console.log('[Profile] Found in Supabase:', supabaseUnit.id);
          
          // Find development by project_id or address pattern matching
          let development: any = null;
          
          // Try project_id first
          if (supabaseUnit.project_id) {
            const { rows: devRows } = await db.execute(sql`
              SELECT id, name, address, logo_url, tenant_id
              FROM developments 
              WHERE id = ${supabaseUnit.project_id}::uuid
            `);
            if (devRows.length > 0) {
              development = devRows[0];
              console.log('[Profile] Matched development by project_id:', development.name);
            }
          }
          
          // Fallback: match by address pattern
          if (!development && supabaseUnit.address) {
            const addressLower = supabaseUnit.address.toLowerCase();
            const { rows: allDevs } = await db.execute(sql`
              SELECT id, name, address, logo_url, tenant_id FROM developments
            `);
            for (const dev of allDevs as any[]) {
              const devNameLower = dev.name.toLowerCase();
              const devWords = devNameLower.split(/\s+/).filter((w: string) => w.length > 3);
              for (const word of devWords) {
                if (addressLower.includes(word)) {
                  development = dev;
                  console.log('[Profile] Matched development by address pattern:', dev.name);
                  break;
                }
              }
              if (development) break;
            }
          }
          
          if (!development) {
            console.log('[Profile] Could not resolve development for Supabase unit:', supabaseUnit.id);
            return NextResponse.json({ error: 'Unit development not found' }, { status: 404 });
          }
          
          // CRITICAL FIX: Match Supabase unit to Drizzle unit by address to get correct house_type_code
          // Do NOT use LIMIT 1 on house_types - that picks wrong type for multi-type developments
          let matchedHouseType: string | null = null;
          let matchedHouseTypeName: string | null = null;
          let matchedBedrooms: number | null = null;
          let matchedBathrooms: number | null = null;

          if (supabaseUnit.address) {
            // Extract unit number from address using flexible patterns:
            // "31 Longview Park", "House 31 Longview", "31, Longview", "Unit 31", "31A Longview"
            const addressNormalized = supabaseUnit.address.trim();
            
            // Try multiple patterns to extract unit number
            const patterns = [
              /^(\d+[A-Za-z]?)[,\s]/,              // "31 Longview" or "31, Longview" or "31A Longview"
              /^(?:House|Unit|No\.?|#)\s*(\d+[A-Za-z]?)/i,  // "House 31" or "Unit 31A"
              /\b(\d+[A-Za-z]?)\s+(?:Longview|Park|Street|Road|Avenue|Lane|Drive)/i  // "at 31 Longview Park"
            ];
            
            let unitNumber: string | null = null;
            for (const pattern of patterns) {
              const match = addressNormalized.match(pattern);
              if (match) {
                unitNumber = match[1];
                break;
              }
            }
            
            if (unitNumber) {
              // Try to find matching Drizzle unit by address containing this number
              // Use fully wildcarded ILIKE patterns to handle all cases:
              // - "31 Longview" (start), "House 31 Longview" (middle), "31, Longview" (comma)
              const { rows: matchedRows } = await db.execute(sql`
                SELECT house_type_code, bedrooms, bathrooms, address_line_1
                FROM units 
                WHERE development_id = ${development.id}::uuid
                  AND (
                    address_line_1 ILIKE ${'%' + unitNumber + ' %'}
                    OR address_line_1 ILIKE ${'%' + unitNumber + ',%'}
                    OR address_line_1 ILIKE ${unitNumber + ' %'}
                    OR address_line_1 ILIKE ${unitNumber + ',%'}
                    OR address_line_1 ~ ${'^' + unitNumber + '[^0-9]'}
                  )
                LIMIT 1
              `);
              
              const matched = matchedRows[0] as any;
              if (matched) {
                matchedHouseType = matched.house_type_code;
                matchedBedrooms = matched.bedrooms;
                matchedBathrooms = matched.bathrooms;
                console.log('[Profile] Matched Supabase unit to Drizzle by address:', unitNumber, '-> house_type:', matchedHouseType, 'matched:', matched.address_line_1);
                
                // Get house type name if we have a code
                if (matchedHouseType) {
                  const { rows: htNameRows } = await db.execute(sql`
                    SELECT name FROM house_types WHERE development_id = ${development.id}::uuid AND house_type_code = ${matchedHouseType}
                  `);
                  if (htNameRows.length > 0) {
                    matchedHouseTypeName = (htNameRows[0] as any).name;
                  }
                }
              }
            }
          }
          
          // Fallback: get sample unit data for bedrooms/bathrooms even if house type matching failed
          if (!matchedBedrooms || !matchedBathrooms) {
            const { rows: sampleUnitRows } = await db.execute(sql`
              SELECT bedrooms, bathrooms 
              FROM units 
              WHERE development_id = ${development.id}::uuid
                AND bedrooms IS NOT NULL
              LIMIT 1
            `);
            const sampleUnit = sampleUnitRows[0] as any;
            if (sampleUnit) {
              matchedBedrooms = matchedBedrooms || sampleUnit.bedrooms;
              matchedBathrooms = matchedBathrooms || sampleUnit.bathrooms;
            }
          }
          
          // Only fall back to first house type if address matching failed
          if (!matchedHouseType) {
            console.log('[Profile] WARNING: Could not match unit by address, using fallback');
            const { rows: houseTypeRows } = await db.execute(sql`
              SELECT house_type_code, name 
              FROM house_types 
              WHERE development_id = ${development.id}::uuid
              ORDER BY house_type_code
              LIMIT 1
            `);
            const houseType = houseTypeRows[0] as any;
            matchedHouseType = houseType?.house_type_code || null;
            matchedHouseTypeName = houseType?.name || null;
          }
          
          console.log('[Profile] Using development:', development?.name, 'House type:', matchedHouseType, 'Beds/Baths:', matchedBedrooms, '/', matchedBathrooms);
          
          unit = {
            id: supabaseUnit.id,
            unit_uid: supabaseUnit.id,
            project_id: development.id,
            development_id: development.id,
            house_type_code: matchedHouseType,
            house_type_name: matchedHouseTypeName || (matchedHouseType ? 'House Type ' + matchedHouseType : null),
            address_line_1: supabaseUnit.address,
            purchaser_name: supabaseUnit.purchaser_name,
            dev_id: development.id,
            dev_name: development.name,
            dev_address: development.address,
            dev_logo_url: development.logo_url,
            bedrooms: matchedBedrooms,
            bathrooms: matchedBathrooms,
          };
        }
      } catch (supabaseErr: any) {
        console.error('[Profile] Supabase lookup error:', supabaseErr.message);
      }
    }

    if (!unit) {
      console.error('[Profile] Unit not found in Drizzle or Supabase:', unitUid);
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const houseTypeCode = unit.house_type_code;

    // Parse specification_json for additional details (will be populated from intel profile)
    let specs: any = {};

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

    // Get documents ONLY for user's specific house_type_code or global docs
    let documents: any[] = [];
    const developmentId = unit.development_id || unit.project_id || unit.dev_id;
    
    try {
      let docRows: any[] = [];
      
      if (houseTypeCode && developmentId) {
        // Only get documents that match the user's house type OR are global
        const houseTypePattern = `%${houseTypeCode}%`;
        const result = await db.execute(sql`
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
            AND development_id = ${developmentId}::uuid
            AND (
              house_type_code = ${houseTypeCode}
              OR UPPER(title) LIKE UPPER(${houseTypePattern})
              OR UPPER(file_name) LIKE UPPER(${houseTypePattern})
              OR (metadata->>'is_global')::boolean = true
            )
          ORDER BY 
            CASE 
              WHEN house_type_code = ${houseTypeCode} THEN 0 
              ELSE 1 
            END,
            created_at DESC
          LIMIT 10
        `);
        docRows = result.rows as any[];
      }
      
      // NO fallback to all development documents - only show house-type specific docs
      
      documents = (docRows || []).map((doc: any) => ({
        id: doc.id,
        title: doc.title,
        file_url: doc.file_url,
        mime_type: doc.mime_type || 'application/pdf',
        category: getCategoryFromDoc(doc),
      }));
      
      console.log('[Profile] Found', documents.length, 'documents for house type:', houseTypeCode);
    } catch (e) {
      console.error('[Profile] Error fetching documents:', e);
    }

    // Build the response with all available details
    const purchaserName = (homeownerData as any)?.name || unit.purchaser_name || 'Homeowner';
    const unitAddress = [unit.address_line_1, unit.address_line_2, unit.city, unit.eircode].filter(Boolean).join(', ');
    const fullAddress = (homeownerData as any)?.address || unitAddress || unit.dev_address || 'Address not available';

    // Get bedrooms/bathrooms from multiple sources (unit, specs, or intel profile)
    const bedrooms = unit.bedrooms || specs?.bedrooms || intelProfile?.rooms?.bedrooms || null;
    const bathrooms = unit.bathrooms || specs?.bathrooms || intelProfile?.rooms?.bathrooms || null;
    const floorArea = intelProfile?.floor_area_total_sqm || specs?.floor_area || null;

    const profile = {
      unit: {
        id: unit.id,
        unit_uid: unit.id,
        address: fullAddress,
        eircode: unit.eircode || null,
        mrpn: unit.mrpn || null,
        electricity_account: unit.electricity_account || null,
        esb_eirgrid_number: unit.esb_eirgrid_number || null,
        house_type_code: houseTypeCode,
        house_type_name: unit.house_type_name || houseTypeCode || 'Your Home',
        bedrooms: bedrooms,
        bathrooms: bathrooms,
        floor_area_sqm: floorArea ? parseFloat(floorArea) : null,
      },
      development: {
        id: unit.dev_id,
        name: unit.dev_name || 'Your Development',
        address: unit.dev_address,
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
