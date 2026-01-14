import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { globalCache } from '@/lib/cache/ttl-cache';
import { generateRequestId, createStructuredError, logCritical, getResponseHeaders, isConnectionPoolError } from '@/lib/api-error-utils';
import { recordCircuitBreakerSuccess, recordCircuitBreakerFailure } from '@/lib/security/rate-limiter';

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
  'rathard': { lat: 51.928542, lng: -8.446790 }, // Rathard Park entrance, Cork - SOURCE OF TRUTH
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

// Hard override coordinates by project/development ID - SOURCE OF TRUTH
const PROJECT_COORDINATES: Record<string, { lat: number; lng: number }> = {
  '6d37c4a8-5319-4d7f-9cd2-4f1a8bc25e91': { lat: 51.928542, lng: -8.446790 }, // Rathard Park (Supabase project ID)
  '6d3789de-2e46-430c-bf31-22224bd878da': { lat: 51.928542, lng: -8.446790 }, // Rathard Park (alternate Supabase ID)
  'e0833063-55ac-4201-a50e-f329c090fbd6': { lat: 51.928542, lng: -8.446790 }, // Rathard Park (Drizzle development ID)
  '57dc3919-2725-4575-8046-9179075ac88e': { lat: 51.9265, lng: -8.4532 }, // Longview Park (Supabase project ID)
  '34316432-f1e8-4297-b993-d9b5c88ee2d8': { lat: 51.9265, lng: -8.4532 }, // Longview Park (Drizzle development ID)
};

// Get coordinates from project/development ID
function getProjectCoordinates(projectId: string | null | undefined): { lat: number; lng: number } | null {
  if (!projectId) return null;
  return PROJECT_COORDINATES[projectId] || null;
}

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
      recordCircuitBreakerSuccess('/api/houses/resolve');
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
              d.logo_url as dev_logo_url,
              d.latitude as dev_latitude,
              d.longitude as dev_longitude
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
              d.logo_url as dev_logo_url,
              d.latitude as dev_latitude,
              d.longitude as dev_longitude
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

    // CRITICAL: Check if Drizzle unit has incomplete branding data
    // If development_id is NULL OR dev_name is NULL, we can't display correct branding
    // Fall through to Supabase which has authoritative project data
    const drizzleUnitIncomplete = unit && (!unit.development_id || !unit.dev_name);
    
    if (drizzleUnitIncomplete) {
      console.log("[Resolve] Drizzle unit incomplete (no development_id/address), checking Supabase for:", token, `requestId=${requestId}`);
    }

    if (unit && !drizzleUnitIncomplete) {
      // Found in units table with complete data
      // Combine address parts for full formatted address
      const addressParts = [
        unit.address_line_1,
        unit.address_line_2,
        unit.city,
        unit.eircode,
      ].filter(Boolean);
      const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : (unit.dev_address || '');
      const unitIdentifier = unit.unit_uid || unit.id;

      console.log("[Resolve] Found complete unit:", unitIdentifier, "Purchaser:", unit.purchaser_name, "Address:", fullAddress, "DevID:", unit.development_id, "DevName:", unit.dev_name);

      // Get development data directly from DB - no hardcoded mappings
      let resolvedDevName = unit.dev_name;
      let resolvedLogoUrl = unit.dev_logo_url;
      let resolvedTenantId = unit.tenant_id;
      
      // If dev_name is null but we have development_id, query DB directly
      if (!resolvedDevName && unit.development_id) {
        console.log("[Resolve] dev_name null, querying DB for:", unit.development_id);
        try {
          const { rows: devRows } = await db.execute(sql`
            SELECT name, logo_url, tenant_id FROM developments WHERE id = ${unit.development_id}::uuid LIMIT 1
          `);
          if (devRows.length > 0) {
            const dev = devRows[0] as any;
            resolvedDevName = dev.name;
            resolvedLogoUrl = resolvedLogoUrl || dev.logo_url;
            resolvedTenantId = resolvedTenantId || dev.tenant_id;
            console.log("[Resolve] DB resolved development:", resolvedDevName);
          }
        } catch (devErr: any) {
          console.error("[Resolve] Development query failed:", devErr.message);
        }
      }

      // Coordinate resolution order: geocode address -> unit lat/lng -> development lat/lng
      let coordinates: { lat: number; lng: number } | null = null;
      
      // Priority 1: Geocode from address (most accurate)
      if (fullAddress) {
        coordinates = await geocodeAddress(fullAddress);
      }
      // Priority 2: Unit-level coordinates
      if (!coordinates && unit.latitude && unit.longitude) {
        coordinates = { lat: unit.latitude, lng: unit.longitude };
      }
      // Priority 3: Development-level coordinates from DB
      if (!coordinates && unit.dev_latitude && unit.dev_longitude) {
        console.log("[Resolve] Using development coordinates as fallback:", unit.dev_latitude, unit.dev_longitude);
        coordinates = { lat: unit.dev_latitude, lng: unit.dev_longitude };
      }

      // Log data error if development name couldn't be resolved (this should NOT happen with correct data)
      if (!resolvedDevName) {
        console.error("[Resolve] DATA_ERROR: Could not resolve development name for unit:", unitIdentifier, "dev_id:", unit.development_id, `requestId=${requestId}`);
      }
      if (!fullAddress) {
        console.error("[Resolve] DATA_ERROR: No address for unit:", unitIdentifier, `requestId=${requestId}`);
      }

      const responseData = {
        success: true,
        unitId: unitIdentifier,
        house_id: unitIdentifier,
        tenantId: resolvedTenantId || null,
        tenant_id: resolvedTenantId || null,
        developmentId: unit.development_id,
        development_id: unit.development_id,
        development_name: resolvedDevName || null, // NULL instead of placeholder - let client decide
        development_code: '',
        development_logo_url: resolvedLogoUrl || null,
        development_system_instructions: '',
        address: fullAddress || null, // NULL instead of placeholder - let client decide
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
        _source: 'drizzle_units', // Debug: data source
      };

      // Cache with tenant-aware key
      const tenantCacheKey = `resolve:${resolvedTenantId || 'unknown'}:${token}`;
      globalCache.set(tenantCacheKey, responseData, 60000);
      globalCache.set(cacheKey, responseData, 60000); // Also set original for compatibility
      console.log(`[Resolve] Cached result for ${token} requestId=${requestId} duration=${Date.now() - startTime}ms`);
      recordCircuitBreakerSuccess('/api/houses/resolve');
      
      // Build response headers with debug info (dev only)
      const responseHeaders = new Headers();
      responseHeaders.set('x-request-id', requestId);
      responseHeaders.set('Content-Type', 'application/json');
      responseHeaders.set('x-cache', 'MISS');
      if (process.env.NODE_ENV === 'development') {
        responseHeaders.set('X-OH-UnitId', unitIdentifier);
        responseHeaders.set('X-OH-DevId', unit.development_id || '');
        responseHeaders.set('X-OH-DevName', resolvedDevName || '');
        responseHeaders.set('X-OH-Source', 'drizzle');
      }
      
      return NextResponse.json(
        { ...responseData, request_id: requestId },
        { headers: responseHeaders }
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
        console.log("[Resolve] Found in Supabase units:", supabaseUnit.id, "Address:", supabaseUnit.address, "ProjectID:", supabaseUnit.project_id);
        
        const fullAddress = supabaseUnit.address || '';
        
        // Coordinate resolution: PROJECT OVERRIDE -> geocode -> project table
        // Priority 1: Hard override by project ID (SOURCE OF TRUTH for known schemes)
        let coordinates = getProjectCoordinates(supabaseUnit.project_id);
        if (coordinates) {
          console.log("[Resolve] Using project coordinate override for:", supabaseUnit.project_id, "->", coordinates);
        }
        // Priority 2: Geocode from address
        if (!coordinates && fullAddress) {
          coordinates = await geocodeAddress(fullAddress);
        }
        // Priority 3: Try to get project coordinates from Supabase projects table
        if (!coordinates && supabaseUnit.project_id) {
          const { data: project } = await supabase
            .from('projects')
            .select('latitude, longitude')
            .eq('id', supabaseUnit.project_id)
            .single();
          
          if (project?.latitude && project?.longitude) {
            console.log("[Resolve] Using project coordinates from DB:", project.latitude, project.longitude);
            coordinates = { lat: project.latitude, lng: project.longitude };
          }
        }
        
        // Resolve development from Supabase project - query DB directly (deterministic)
        let resolvedDevName: string | null = null;
        let resolvedLogoUrl: string | null = null;
        let resolvedTenantId: string | null = null;
        let drizzleDevelopmentId: string | null = null;
        
        // Try to get project name from Supabase projects table, then match to Drizzle by exact name
        if (supabaseUnit.project_id) {
          try {
            const { data: project } = await supabase
              .from('projects')
              .select('name, logo_url')
              .eq('id', supabaseUnit.project_id)
              .single();
            
            if (project?.name) {
              console.log("[Resolve] Supabase project name:", project.name);
              
              // Match to Drizzle development by EXACT name (case-insensitive)
              const { rows: devRows } = await db.execute(sql`
                SELECT id, name, logo_url, tenant_id FROM developments WHERE LOWER(name) = LOWER(${project.name}) LIMIT 1
              `);
              if (devRows.length > 0) {
                const dev = devRows[0] as any;
                drizzleDevelopmentId = dev.id;
                resolvedDevName = dev.name; // Use Drizzle name (canonical)
                resolvedLogoUrl = dev.logo_url || project.logo_url || null;
                resolvedTenantId = dev.tenant_id;
                console.log("[Resolve] Matched to Drizzle development by exact name:", resolvedDevName, "tenant:", resolvedTenantId);
              } else {
                // Supabase project exists but no matching Drizzle development
                // Use Supabase project name as-is (safe - it's the authoritative name)
                resolvedDevName = project.name;
                resolvedLogoUrl = project.logo_url || null;
                console.log("[Resolve] Using Supabase project name (no Drizzle match):", resolvedDevName);
              }
            }
          } catch (projectErr: any) {
            console.log("[Resolve] Supabase project lookup failed:", projectErr.message);
          }
        }
        
        // If we couldn't resolve from project, log as DATA_ERROR
        // DO NOT guess from address patterns - this risks cross-tenant leakage
        if (!resolvedDevName) {
          console.error("[Resolve] DATA_ERROR: Could not resolve development for Supabase unit:", supabaseUnit.id, "project_id:", supabaseUnit.project_id, `requestId=${requestId}`);
        }
        
        // Cross-reference with Drizzle units to get full purchaser name
        let fullPurchaserName = supabaseUnit.purchaser_name || '';
        
        if (fullAddress && drizzleDevelopmentId) {
          try {
            const unitNumMatch = fullAddress.match(/^(\d+[A-Za-z]?)\s/);
            const unitNumber = unitNumMatch ? unitNumMatch[1] : null;
            
            if (unitNumber) {
              const drizzleUnitResult = await db.execute(sql`
                SELECT purchaser_name 
                FROM units 
                WHERE development_id = ${drizzleDevelopmentId}::uuid
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
        
        recordCircuitBreakerSuccess('/api/houses/resolve');
        
        const responseData = {
          success: true,
          unitId: supabaseUnit.id,
          house_id: supabaseUnit.id,
          tenantId: resolvedTenantId || null,
          tenant_id: resolvedTenantId || null,
          developmentId: drizzleDevelopmentId || supabaseUnit.project_id,
          development_id: drizzleDevelopmentId || supabaseUnit.project_id,
          supabase_project_id: supabaseUnit.project_id,
          development_name: resolvedDevName || null, // NULL instead of placeholder
          development_code: '',
          development_logo_url: resolvedLogoUrl || null,
          development_system_instructions: '',
          address: fullAddress || null, // NULL instead of placeholder
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
          _source: 'supabase_units', // Debug: data source
        };
        
        // Cache with tenant-aware key
        const tenantCacheKey = `resolve:${resolvedTenantId || 'unknown'}:${token}`;
        globalCache.set(tenantCacheKey, responseData, 60000);
        globalCache.set(cacheKey, responseData, 60000);
        
        // Build response headers with debug info (dev only)
        const responseHeaders = new Headers();
        responseHeaders.set('x-request-id', requestId);
        responseHeaders.set('Content-Type', 'application/json');
        responseHeaders.set('x-cache', 'MISS');
        if (process.env.NODE_ENV === 'development') {
          responseHeaders.set('X-OH-UnitId', supabaseUnit.id);
          responseHeaders.set('X-OH-DevId', (drizzleDevelopmentId || supabaseUnit.project_id) || '');
          responseHeaders.set('X-OH-DevName', resolvedDevName || '');
          responseHeaders.set('X-OH-Source', 'supabase');
        }
        
        return NextResponse.json(
          { ...responseData, request_id: requestId },
          { headers: responseHeaders }
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
              d.logo_url as dev_logo_url,
              d.latitude as dev_latitude,
              d.longitude as dev_longitude
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
              d.logo_url as dev_logo_url,
              d.latitude as dev_latitude,
              d.longitude as dev_longitude
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
          recordCircuitBreakerFailure('/api/houses/resolve');
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

      console.log("[Resolve] Found homeowner:", homeowner.id, "Name:", homeowner.name, "Address:", fullAddress, "DevID:", homeowner.development_id, "DevName:", homeowner.dev_name);

      // Get development data directly from DB - no hardcoded mappings
      let resolvedDevName = homeowner.dev_name;
      let resolvedLogoUrl = homeowner.dev_logo_url;
      let resolvedTenantId = homeowner.tenant_id;
      
      // If dev_name is null but we have development_id, query DB directly
      if (!resolvedDevName && homeowner.development_id) {
        console.log("[Resolve] homeowner dev_name null, querying DB for:", homeowner.development_id);
        try {
          const { rows: devRows } = await db.execute(sql`
            SELECT name, logo_url, tenant_id FROM developments WHERE id = ${homeowner.development_id}::uuid LIMIT 1
          `);
          if (devRows.length > 0) {
            const dev = devRows[0] as any;
            resolvedDevName = dev.name;
            resolvedLogoUrl = resolvedLogoUrl || dev.logo_url;
            resolvedTenantId = resolvedTenantId || dev.tenant_id;
            console.log("[Resolve] DB resolved development for homeowner:", resolvedDevName);
          }
        } catch (devErr: any) {
          console.error("[Resolve] Development query failed for homeowner:", devErr.message);
        }
      }

      // Log data error if development name couldn't be resolved
      if (!resolvedDevName) {
        console.error("[Resolve] DATA_ERROR: Could not resolve development for homeowner:", homeowner.id, "dev_id:", homeowner.development_id, `requestId=${requestId}`);
      }

      // Coordinate resolution: geocode address -> development fallback
      let coordinates: { lat: number; lng: number } | null = null;
      
      // Priority 1: Geocode from address (most accurate)
      if (fullAddress) {
        coordinates = await geocodeAddress(fullAddress);
      }
      // Priority 2: Development coordinates from DB
      if (!coordinates && homeowner.dev_latitude && homeowner.dev_longitude) {
        console.log("[Resolve] Using development coordinates from DB:", homeowner.dev_latitude, homeowner.dev_longitude);
        coordinates = { lat: homeowner.dev_latitude, lng: homeowner.dev_longitude };
      }

      recordCircuitBreakerSuccess('/api/houses/resolve');
      
      const responseData = {
        success: true,
        unitId: homeowner.id,
        house_id: homeowner.id,
        tenantId: resolvedTenantId || null,
        tenant_id: resolvedTenantId || null,
        developmentId: homeowner.development_id,
        development_id: homeowner.development_id,
        development_name: resolvedDevName || null,
        development_code: '',
        development_logo_url: resolvedLogoUrl || null,
        development_system_instructions: '',
        address: fullAddress || null,
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
        _source: 'homeowners',
      };
      
      // Cache with tenant-aware key
      const tenantCacheKey = `resolve:${resolvedTenantId || 'unknown'}:${token}`;
      globalCache.set(tenantCacheKey, responseData, 60000);
      globalCache.set(cacheKey, responseData, 60000);
      
      return NextResponse.json(
        { ...responseData, request_id: requestId },
        { headers: getResponseHeaders(requestId) }
      );
    } catch (homeownerErr: any) {
      console.error("[Resolve] Homeowner lookup error:", homeownerErr.message, `requestId=${requestId}`);
      if (isConnectionPoolError(homeownerErr) || dbConnectionError) {
        recordCircuitBreakerFailure('/api/houses/resolve');
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
    recordCircuitBreakerFailure('/api/houses/resolve');
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
