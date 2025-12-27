import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';
import { resolveDevelopment } from '@/lib/development-resolver';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { globalCache } from '@/lib/cache/ttl-cache';
import { generateRequestId, createStructuredError, logCritical, getResponseHeaders, isConnectionPoolError } from '@/lib/api-error-utils';

export const dynamic = 'force-dynamic';

function getClientIP(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  return xff?.split(',')[0]?.trim() || '127.0.0.1';
}

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Known Irish location coordinates for fallback
const IRISH_LOCATIONS: Record<string, { lat: number; lng: number }> = {
  // Specific developments - exact coordinates provided by client
  'longview': { lat: 51.9265, lng: -8.4532 }, // Longview Park entrance, Ballyvolane, Cork (51°55'35.3"N 8°27'11.6"W)
  'ballyvolane': { lat: 51.9265, lng: -8.4532 },
  'ballyhooly': { lat: 51.9265, lng: -8.4532 },
  // Cities
  'cork': { lat: 51.8985, lng: -8.4756 },
  'dublin': { lat: 53.3498, lng: -6.2603 },
  'galway': { lat: 53.2707, lng: -9.0568 },
  'limerick': { lat: 52.6638, lng: -8.6267 },
  'waterford': { lat: 52.2593, lng: -7.1101 },
  'kilkenny': { lat: 52.6541, lng: -7.2448 },
  'drogheda': { lat: 53.7189, lng: -6.3478 },
  'dundalk': { lat: 54.0027, lng: -6.4016 },
  'sligo': { lat: 54.2766, lng: -8.4761 },
  'athlone': { lat: 53.4229, lng: -7.9407 },
  'wexford': { lat: 52.3369, lng: -6.4633 },
  'carlow': { lat: 52.8408, lng: -6.9261 },
  'tralee': { lat: 52.2711, lng: -9.6868 },
  'killarney': { lat: 52.0599, lng: -9.5044 },
  'ennis': { lat: 52.8463, lng: -8.9811 },
  'letterkenny': { lat: 54.9558, lng: -7.7342 },
};

// Get coordinates from address using known locations
function getCoordinatesFromAddress(address: string): { lat: number; lng: number } | null {
  if (!address) return null;
  
  const lowerAddress = address.toLowerCase();
  
  // Check for known location keywords in the address
  for (const [keyword, coords] of Object.entries(IRISH_LOCATIONS)) {
    if (lowerAddress.includes(keyword)) {
      console.log("[Resolve] Matched location keyword:", keyword, "->", coords);
      return coords;
    }
  }
  
  return null;
}

// Geocode an address using Google Geocoding API with fallback
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  // First try known locations fallback (faster and doesn't require API)
  const knownCoords = getCoordinatesFromAddress(address);
  if (knownCoords) {
    console.log("[Resolve] Using known coordinates for:", address);
    return knownCoords;
  }
  
  // Try Google Geocoding API
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey || !address) return null;
  
  try {
    const searchAddress = address.includes('Ireland') ? address : `${address}, Ireland`;
    const encodedAddress = encodeURIComponent(searchAddress);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results?.[0]?.geometry?.location) {
      const location = data.results[0].geometry.location;
      console.log("[Resolve] Geocoded address:", address, "->", location);
      return { lat: location.lat, lng: location.lng };
    }
    console.log("[Resolve] Geocoding failed for:", address, "Status:", data.status);
    return null;
  } catch (error) {
    console.error("[Resolve] Geocoding error:", error);
    return null;
  }
}

export async function POST(req: Request) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const clientIP = getClientIP(req);

  const rateCheck = checkRateLimit(clientIP, '/api/houses/resolve');
  if (!rateCheck.allowed) {
    console.log(`[Resolve] Rate limit exceeded for ${clientIP} requestId=${requestId}`);
    return NextResponse.json(
      createStructuredError('Too many requests', requestId, {
        error_code: 'RATE_LIMITED',
        retryable: true,
      }),
      { status: 429, headers: { ...getResponseHeaders(requestId), 'retry-after': String(Math.ceil(rateCheck.resetMs / 1000)) } }
    );
  }

  try {
    const supabase = getSupabaseClient();
    let body: any = {};
    
    try {
      body = await req.json();
    } catch (e) {
      console.log("[Resolve] Failed to parse body:", e);
    }
    
    const token = body?.token || body?.unitId || body?.unit_id;

    if (!token) {
      console.log("[Resolve] No token provided", `requestId=${requestId}`);
      return NextResponse.json(
        createStructuredError('No token provided', requestId, { error_code: 'MISSING_TOKEN' }),
        { status: 400, headers: getResponseHeaders(requestId) }
      );
    }

    const cacheKey = `resolve:${token}`;
    const cached = globalCache.get(cacheKey);
    if (cached) {
      console.log(`[Resolve] Cache hit for ${token} requestId=${requestId} duration=${Date.now() - startTime}ms`);
      return NextResponse.json(
        { ...cached, request_id: requestId },
        { headers: { ...getResponseHeaders(requestId), 'x-cache': 'HIT' } }
      );
    }

    console.log("[Resolve] Looking up unit:", token, `requestId=${requestId}`);
    
    // Track if we hit a database connection error vs actual not found
    let dbConnectionError = false;

    // Check if token is UUID format or unit_uid format (e.g., LV-PARK-008)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(token);

    // First try: Query units table by ID or unit_uid using Drizzle
    // Use different query based on whether token is UUID format or not
    let unitResult;
    try {
      unitResult = isUuid 
        ? await db.execute(sql`
            SELECT 
              u.id,
              u.unit_uid,
              u.development_id,
              u.house_type_code,
              u.address_line_1,
              u.address_line_2,
              u.city,
              u.eircode,
              u.purchaser_name,
              u.tenant_id,
              u.latitude,
              u.longitude,
              d.id as dev_id,
              d.name as dev_name,
              d.address as dev_address,
              d.logo_url as dev_logo_url
            FROM units u
            LEFT JOIN developments d ON u.development_id = d.id
            WHERE u.id = ${token}::uuid OR u.unit_uid = ${token}
            LIMIT 1
          `)
        : await db.execute(sql`
            SELECT 
              u.id,
              u.unit_uid,
              u.development_id,
              u.house_type_code,
              u.address_line_1,
              u.address_line_2,
              u.city,
              u.eircode,
              u.purchaser_name,
              u.tenant_id,
              u.latitude,
              u.longitude,
              d.id as dev_id,
              d.name as dev_name,
              d.address as dev_address,
              d.logo_url as dev_logo_url
            FROM units u
            LEFT JOIN developments d ON u.development_id = d.id
            WHERE u.unit_uid = ${token}
            LIMIT 1
          `);
    } catch (dbErr: any) {
      console.error("[Resolve] Database error during unit lookup:", dbErr.message);
      if (dbErr.message?.includes('MaxClients') || dbErr.message?.includes('pool') || dbErr.code === 'XX000') {
        dbConnectionError = true;
      }
      unitResult = { rows: [] };
    }

    const unit = unitResult.rows[0] as any;

    if (unit) {
      // Found in units table
      const fullAddress = unit.address_line_1 || unit.dev_address || '';
      const unitIdentifier = unit.unit_uid || unit.id;

      console.log("[Resolve] Found unit:", unitIdentifier, "Purchaser:", unit.purchaser_name, "Address:", fullAddress);

      const coordinates = fullAddress ? await geocodeAddress(fullAddress) : 
        (unit.latitude && unit.longitude ? { lat: unit.latitude, lng: unit.longitude } : null);

      const responseData = {
        success: true,
        unitId: unitIdentifier,
        house_id: unitIdentifier,
        tenantId: unit.tenant_id || null,
        tenant_id: unit.tenant_id || null,
        developmentId: unit.development_id,
        development_id: unit.development_id,
        development_name: unit.dev_name || 'Your Development',
        development_code: '',
        development_logo_url: unit.dev_logo_url || null,
        development_system_instructions: '',
        address: fullAddress || 'Your Home',
        eircode: unit.eircode || '',
        purchaserName: unit.purchaser_name || 'Homeowner',
        purchaser_name: unit.purchaser_name || 'Homeowner',
        user_id: null,
        project_id: unit.development_id,
        houseType: unit.house_type_code || null,
        house_type: unit.house_type_code || null,
        floorPlanUrl: null,
        floor_plan_pdf_url: null,
        latitude: coordinates?.lat || null,
        longitude: coordinates?.lng || null,
        specs: null,
      };

      globalCache.set(cacheKey, responseData, 60000);
      console.log(`[Resolve] Cached result for ${token} requestId=${requestId} duration=${Date.now() - startTime}ms`);
      return NextResponse.json(
        { ...responseData, request_id: requestId },
        { headers: { ...getResponseHeaders(requestId), 'x-cache': 'MISS' } }
      );
    }

    // Second try: Check Supabase units table (legacy data source)
    console.log("[Resolve] Not found in Drizzle units, checking Supabase units table...");
    
    try {
      const { data: supabaseUnit, error: supabaseError } = await supabase
        .from('units')
        .select('id, address, purchaser_name, project_id')
        .eq('id', token)
        .single();
      
      if (supabaseUnit && !supabaseError) {
        console.log("[Resolve] Found in Supabase units:", supabaseUnit.id, "Address:", supabaseUnit.address);
        
        const fullAddress = supabaseUnit.address || '';
        const coordinates = fullAddress ? await geocodeAddress(fullAddress) : null;
        
        // Use development resolver to get both Supabase and Drizzle IDs
        const resolved = await resolveDevelopment(supabaseUnit.project_id, fullAddress);
        
        console.log("[Resolve] Resolved development:", resolved?.developmentName, 
          "Supabase ID:", resolved?.supabaseProjectId, 
          "Drizzle ID:", resolved?.drizzleDevelopmentId);
        
        // Cross-reference with Drizzle units to get full purchaser name
        // Supabase may only have surnames, Drizzle has full names
        let fullPurchaserName = supabaseUnit.purchaser_name || '';
        
        if (fullAddress && resolved?.drizzleDevelopmentId) {
          try {
            // Extract unit number from address (e.g., "31 Longview Park" -> "31")
            const unitNumMatch = fullAddress.match(/^(\d+[A-Za-z]?)\s/);
            const unitNumber = unitNumMatch ? unitNumMatch[1] : null;
            
            if (unitNumber) {
              const drizzleUnitResult = await db.execute(sql`
                SELECT purchaser_name 
                FROM units 
                WHERE development_id = ${resolved.drizzleDevelopmentId}::uuid
                  AND (
                    address_line_1 ILIKE ${unitNumber + ' %'}
                    OR address_line_1 ILIKE ${unitNumber + ',%'}
                    OR unit_number = ${unitNumber}
                  )
                LIMIT 1
              `);
              
              const drizzleUnit = drizzleUnitResult.rows[0] as any;
              if (drizzleUnit?.purchaser_name) {
                console.log("[Resolve] Cross-referenced full name from Drizzle:", drizzleUnit.purchaser_name);
                fullPurchaserName = drizzleUnit.purchaser_name;
              }
            }
          } catch (crossRefErr: any) {
            console.log("[Resolve] Drizzle cross-reference failed:", crossRefErr.message);
          }
        }
        
        return NextResponse.json(
          {
            success: true,
            unitId: supabaseUnit.id,
            house_id: supabaseUnit.id,
            tenantId: resolved?.tenantId || null,
            tenant_id: resolved?.tenantId || null,
            developmentId: resolved?.drizzleDevelopmentId || supabaseUnit.project_id,
            development_id: resolved?.drizzleDevelopmentId || supabaseUnit.project_id,
            supabase_project_id: supabaseUnit.project_id,
            development_name: resolved?.developmentName || 'Your Development',
            development_code: '',
            development_logo_url: resolved?.logoUrl || null,
            development_system_instructions: '',
            address: fullAddress || 'Your Home',
            eircode: '',
            purchaserName: fullPurchaserName || 'Homeowner',
            purchaser_name: fullPurchaserName || 'Homeowner',
            user_id: null,
            project_id: supabaseUnit.project_id,
            houseType: null,
            house_type: null,
            floorPlanUrl: null,
            floor_plan_pdf_url: null,
            latitude: coordinates?.lat || null,
            longitude: coordinates?.lng || null,
            specs: null,
            request_id: requestId,
          },
          { headers: getResponseHeaders(requestId) }
        );
      }
    } catch (supabaseErr: any) {
      console.log("[Resolve] Supabase lookup failed:", supabaseErr.message, `requestId=${requestId}`);
    }

    // Third try: Check homeowners table by unique_qr_token OR id using Drizzle
    console.log("[Resolve] Not found in Supabase, checking homeowners table...");
    
    try {
      const homeownerResult = isUuid 
        ? await db.execute(sql`
            SELECT 
              h.id,
              h.name,
              h.email,
              h.house_type,
              h.address,
              h.unique_qr_token,
              h.development_id,
              h.tenant_id,
              d.id as dev_id,
              d.name as dev_name,
              d.address as dev_address,
              d.logo_url as dev_logo_url
            FROM homeowners h
            LEFT JOIN developments d ON h.development_id = d.id
            WHERE h.id = ${token}::uuid 
               OR h.unique_qr_token = ${token}
            LIMIT 1
          `)
        : await db.execute(sql`
            SELECT 
              h.id,
              h.name,
              h.email,
              h.house_type,
              h.address,
              h.unique_qr_token,
              h.development_id,
              h.tenant_id,
              d.id as dev_id,
              d.name as dev_name,
              d.address as dev_address,
              d.logo_url as dev_logo_url
            FROM homeowners h
            LEFT JOIN developments d ON h.development_id = d.id
            WHERE h.unique_qr_token = ${token}
            LIMIT 1
          `);

      const homeowner = homeownerResult.rows[0] as any;

      if (!homeowner) {
        console.log("[Resolve] No unit or homeowner found for:", token);
        if (dbConnectionError) {
          console.log("[Resolve] Returning service unavailable due to earlier DB connection issues", `requestId=${requestId}`);
          return NextResponse.json(
            createStructuredError('Service temporarily unavailable', requestId, {
              error_code: 'DB_UNAVAILABLE',
              retryable: true,
            }),
            { status: 503, headers: getResponseHeaders(requestId) }
          );
        }
        return NextResponse.json(
          createStructuredError('Unit not found', requestId, { error_code: 'NOT_FOUND' }),
          { status: 404, headers: getResponseHeaders(requestId) }
        );
      }

      // Found in homeowners table
      const fullAddress = homeowner.address || homeowner.dev_address || '';

      console.log("[Resolve] Found homeowner:", homeowner.id, "Name:", homeowner.name, "Address:", fullAddress);

      // Geocode the address to get coordinates for the map
      const coordinates = fullAddress ? await geocodeAddress(fullAddress) : null;

      return NextResponse.json(
        {
          success: true,
          unitId: homeowner.id,
          house_id: homeowner.id,
          tenantId: homeowner.tenant_id || null,
          tenant_id: homeowner.tenant_id || null,
          developmentId: homeowner.development_id,
          development_id: homeowner.development_id,
          development_name: homeowner.dev_name || 'Your Development',
          development_code: '',
          development_logo_url: homeowner.dev_logo_url || null,
          development_system_instructions: '',
          address: fullAddress || 'Your Home',
          eircode: '',
          purchaserName: homeowner.name || 'Homeowner',
          purchaser_name: homeowner.name || 'Homeowner',
          user_id: null,
          project_id: homeowner.development_id,
          houseType: homeowner.house_type || null,
          house_type: homeowner.house_type || null,
          floorPlanUrl: null,
          floor_plan_pdf_url: null,
          latitude: coordinates?.lat || null,
          longitude: coordinates?.lng || null,
          specs: null,
          request_id: requestId,
        },
        { headers: getResponseHeaders(requestId) }
      );
    } catch (homeownerErr: any) {
      console.error("[Resolve] Homeowner lookup error:", homeownerErr.message, `requestId=${requestId}`);
      if (isConnectionPoolError(homeownerErr) || dbConnectionError) {
        return NextResponse.json(
          createStructuredError('Service temporarily unavailable', requestId, {
            error_code: 'DB_UNAVAILABLE',
            retryable: true,
          }),
          { status: 503, headers: getResponseHeaders(requestId) }
        );
      }
      return NextResponse.json(
        createStructuredError('Unit not found', requestId, { error_code: 'NOT_FOUND' }),
        { status: 404, headers: getResponseHeaders(requestId) }
      );
    }

  } catch (err: any) {
    logCritical('Resolve', 'Server error during unit resolution', requestId, {
      error: err.message || 'Unknown error',
    });
    if (isConnectionPoolError(err)) {
      return NextResponse.json(
        createStructuredError('Service temporarily unavailable', requestId, {
          error_code: 'DB_UNAVAILABLE',
          retryable: true,
        }),
        { status: 503, headers: getResponseHeaders(requestId) }
      );
    }
    return NextResponse.json(
      createStructuredError(err.message || 'Server error', requestId, {
        error_code: 'SERVER_ERROR',
        retryable: true,
      }),
      { status: 500, headers: getResponseHeaders(requestId) }
    );
  }
}
