import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// CRITICAL: Use Service Role Key so we can find the unit BEFORE login
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

export async function POST(req: Request) {
  try {
    const { token } = await req.json(); // The token is just the Unit ID now

    if (!token) {
      return NextResponse.json({ error: "No token provided" }, { status: 400 });
    }

    console.log("Resolving Unit ID:", token);

    // Fetch the unit and its type details
    const { data: unit, error } = await supabase
      .from('units')
      .select(`
        id,
        address,
        purchaser_name,
        project_id,
        unit_types (
          name,
          floor_plan_pdf_url,
          specification_json
        )
      `)
      .eq('id', token)
      .single();

    if (error || !unit) {
      console.error("Resolution Error:", error?.message);
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    // Return the data needed for the Welcome Screen
    return NextResponse.json({
      unitId: unit.id,
      address: unit.address,
      purchaserName: unit.purchaser_name, // Send name to frontend
      floorPlanUrl: unit.unit_types?.floor_plan_pdf_url,
      specs: unit.unit_types?.specification_json
    });

  } catch (err: any) {
    console.error("Server Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}