import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    let body;
    try {
      const text = await req.text();
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }
    const token = body.token || body.unitId || body.unit_id;

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
    const { data: unit, error } = await supabase
      .from('units')
      .select(`
        id, 
        address, 
        purchaser_name, 
        project_id,
        unit_type_id,
        unit_types (
          name,
          floor_plan_pdf_url,
          specification_json
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

    console.log("[Resolve] Found unit:", unit.id, "Purchaser:", unit.purchaser_name);

    return NextResponse.json({
      success: true,
      unitId: unit.id,
      address: unit.address || 'Your Home',
      purchaserName: unit.purchaser_name || 'Homeowner',
      projectId: unit.project_id,
      houseType: unitType?.name || null,
      floorPlanUrl: unitType?.floor_plan_pdf_url || null,
      specs: unitType?.specification_json || null,
    });

  } catch (err: any) {
    console.error("[Resolve] Server Error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
