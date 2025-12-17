import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';
import { resolveDevelopment } from '@/lib/development-resolver';

export const dynamic = 'force-dynamic';

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
  try {
    const supabase = getSupabaseClient();
    let body: any = {};
    
    // Parse URL to get query parameters as fallback
    const url = new URL(req.url);
    const queryToken = url.searchParams.get('token') || url.searchParams.get('unitId');
    
    // Debug: Log request details
    console.log("[Resolve] Request method:", req.method);
    console.log("[Resolve] Content-Type:", req.headers.get('content-type'));
    
    try {
      const text = await req.text();
      console.log("[Resolve] Raw body text:", text ? `"${text.substring(0, 100)}..."` : "(empty)");
      if (text && text.trim()) {
        body = JSON.parse(text);
        console.log("[Resolve] Parsed body:", JSON.stringify(body));
      }
    } catch (e) {
      console.log("[Resolve] Failed to parse body:", e);
    }
    
    const token = body?.token || body?.unitId || body?.unit_id || queryToken;

    if (!token) {
      console.log("[Resolve] No token provided - body:", JSON.stringify(body), "queryToken:", queryToken);
      return NextResponse.json({ error: "No token provided" }, { status: 400 });
    }

    console.log("[Resolve] Looking up unit:", token);

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      console.log("[Resolve] Invalid UUID format:", token);
      return NextResponse.json({ error: "Invalid unit identifier" }, { status: 400 });
    }

    // First try: Query units table by ID or unit_uid using Drizzle
    const unitResult = await db.execute(sql`
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
    `);

    const unit = unitResult.rows[0] as any;

    if (unit) {
      // Found in units table
      const fullAddress = unit.address_line_1 || unit.dev_address || '';
      const unitIdentifier = unit.unit_uid || unit.id;

      console.log("[Resolve] Found unit:", unitIdentifier, "Purchaser:", unit.purchaser_name, "Address:", fullAddress);

      const coordinates = fullAddress ? await geocodeAddress(fullAddress) : 
        (unit.latitude && unit.longitude ? { lat: unit.latitude, lng: unit.longitude } : null);

      return NextResponse.json({
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
      });
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
        
        return NextResponse.json({
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
          purchaserName: supabaseUnit.purchaser_name || 'Homeowner',
          purchaser_name: supabaseUnit.purchaser_name || 'Homeowner',
          user_id: null,
          project_id: supabaseUnit.project_id,
          houseType: null,
          house_type: null,
          floorPlanUrl: null,
          floor_plan_pdf_url: null,
          latitude: coordinates?.lat || null,
          longitude: coordinates?.lng || null,
          specs: null,
        });
      }
    } catch (supabaseErr: any) {
      console.log("[Resolve] Supabase lookup failed:", supabaseErr.message);
    }

    // Third try: Check homeowners table by unique_qr_token OR id using Drizzle
    console.log("[Resolve] Not found in Supabase, checking homeowners table...");
    
    try {
      const homeownerResult = await db.execute(sql`
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
      `);

      const homeowner = homeownerResult.rows[0] as any;

      if (!homeowner) {
        console.log("[Resolve] No unit or homeowner found for:", token);
        
        // FALLBACK: For demo/development access, return a generic Longview Park unit
        // This matches the documents API behavior which uses PROJECT_ID fallback
        console.log("[Resolve] Using Longview Park demo fallback for unit:", token);
        
        const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';
        const LONGVIEW_PARK_DEV_ID = '34316432-f1e8-4297-b993-d9b5c88ee2d8';
        const LONGVIEW_COORDS = { lat: 51.9265, lng: -8.4532 };
        
        return NextResponse.json({
          success: true,
          unitId: token,
          house_id: token,
          tenantId: 'fdd1bd1a-97fa-4a1c-94b5-ae22dceb077d',
          tenant_id: 'fdd1bd1a-97fa-4a1c-94b5-ae22dceb077d',
          developmentId: LONGVIEW_PARK_DEV_ID,
          development_id: LONGVIEW_PARK_DEV_ID,
          supabase_project_id: PROJECT_ID,
          development_name: 'Longview Park',
          development_code: 'LV-PARK',
          development_logo_url: null,
          development_system_instructions: '',
          address: 'Longview Park, Ballyhooly Road, Ballyvolane, Cork City',
          eircode: '',
          purchaserName: 'Demo Homeowner',
          purchaser_name: 'Demo Homeowner',
          user_id: null,
          project_id: PROJECT_ID,
          houseType: null,
          house_type: null,
          floorPlanUrl: null,
          floor_plan_pdf_url: null,
          latitude: LONGVIEW_COORDS.lat,
          longitude: LONGVIEW_COORDS.lng,
          specs: null,
        });
      }

      // Found in homeowners table
      const fullAddress = homeowner.address || homeowner.dev_address || '';

      console.log("[Resolve] Found homeowner:", homeowner.id, "Name:", homeowner.name, "Address:", fullAddress);

      // Geocode the address to get coordinates for the map
      const coordinates = fullAddress ? await geocodeAddress(fullAddress) : null;

      return NextResponse.json({
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
      });
    } catch (homeownerErr: any) {
      console.error("[Resolve] Homeowner lookup error:", homeownerErr.message);
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

  } catch (err: any) {
    console.error("[Resolve] Server Error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
