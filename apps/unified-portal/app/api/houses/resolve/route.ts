import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// CRITICAL: Use Service Role Key to bypass RLS for public QR scans
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "No token provided" }, { status: 400 });
    }

    console.log("[Resolve] Looking up unit:", token);

    // Simple query without join
    const { data: unit, error } = await supabase
      .from('units')
      .select('id, address, purchaser_name, unit_type_id')
      .eq('id', token)
      .single();

    if (error || !unit) {
      console.error("[Resolve] Error:", error?.message);
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    console.log("[Resolve] Found unit:", unit.id, "Purchaser:", unit.purchaser_name);

    return NextResponse.json({
      unitId: unit.id,
      address: unit.address,
      purchaserName: unit.purchaser_name,
      floorPlanUrl: null,
      specs: null
    });

  } catch (err: any) {
    console.error("[Resolve] Server Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
