import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Known Irish location coordinates for fallback
const IRISH_LOCATIONS: Record<string, { lat: number; lng: number }> = {
  // Specific developments
  'longview': { lat: 51.9165, lng: -8.4756 }, // Longview Park, Ballyvolane, Cork
  'ballyvolane': { lat: 51.9165, lng: -8.4756 },
  'ballyhooly': { lat: 51.9165, lng: -8.4756 },
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
    let body: any = {};
    
    try {
      body = await req.json();
    } catch (e) {
      console.log("[Resolve] Failed to parse body:", e);
    }
    
    const token = body?.token || body?.unitId || body?.unit_id;

    if (!token) {
      console.log("[Resolve] No token provided");
      return NextResponse.json({ error: "No token provided" }, { status: 400 });
    }

    console.log("[Resolve] Looking up unit:", token);

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      console.log("[Resolve] Invalid UUID format:", token);
      return NextResponse.json({ error: "Invalid unit identifier" }, { status: 400 });
    }

    // Query by ID only - no project filter (UUIDs are unique)
    // Also get unit_type and project info
    const { data: unit, error } = await supabase
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
      .eq('id', token)
      .single();

    if (error) {
      console.error("[Resolve] Database error:", error.message);
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    if (!unit) {
      console.log("[Resolve] No unit found for:", token);
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const unitType = Array.isArray(unit.unit_types) ? unit.unit_types[0] : unit.unit_types;
    const project = Array.isArray(unit.projects) ? unit.projects[0] : unit.projects;
    const fullAddress = unit.address || project?.address || '';

    console.log("[Resolve] Found unit:", unit.id, "Purchaser:", unit.purchaser_name, "Address:", fullAddress);

    // Geocode the address to get coordinates for the map
    const coordinates = fullAddress ? await geocodeAddress(fullAddress) : null;

    return NextResponse.json({
      success: true,
      unitId: unit.id,
      tenantId: project?.organization_id || null,
      developmentId: unit.project_id,
      development_id: unit.project_id,
      development_name: project?.name || 'Your Development',
      development_code: '',
      development_logo_url: project?.image_url || null,
      development_system_instructions: '',
      address: fullAddress || 'Your Home',
      eircode: '',
      purchaserName: unit.purchaser_name || 'Homeowner',
      user_id: unit.user_id,
      project_id: unit.project_id,
      houseType: unitType?.name || null,
      house_type: unitType?.name || null,
      floorPlanUrl: unitType?.floor_plan_pdf_url || null,
      floor_plan_pdf_url: unitType?.floor_plan_pdf_url || null,
      latitude: coordinates?.lat || null,
      longitude: coordinates?.lng || null,
      specs: unitType?.specification_json || null,
    });

  } catch (err: any) {
    console.error("[Resolve] Server Error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
