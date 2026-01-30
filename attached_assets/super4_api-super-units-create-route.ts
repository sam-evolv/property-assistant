import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      development_id,
      tenant_id,
      unit_number,
      address,
      unit_type,
      purchaser_name,
      purchaser_email,
      purchaser_phone,
      handover_date,
      access_code
    } = body;

    // Validate required fields
    if (!development_id) {
      return NextResponse.json({ error: 'development_id is required' }, { status: 400 });
    }

    if (!unit_number && !address) {
      return NextResponse.json({ error: 'unit_number or address is required' }, { status: 400 });
    }

    // Generate access code if not provided
    let finalAccessCode = access_code;
    if (!finalAccessCode) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let random = '';
      for (let i = 0; i < 8; i++) {
        random += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      finalAccessCode = random;
    }

    // Check for duplicate access code
    const { data: existing } = await supabaseAdmin
      .from('units')
      .select('id')
      .eq('access_code', finalAccessCode)
      .single();

    if (existing) {
      // Regenerate code if duplicate
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let random = '';
      for (let i = 0; i < 8; i++) {
        random += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      finalAccessCode = random;
    }

    // Create unit
    const { data: unit, error } = await supabaseAdmin
      .from('units')
      .insert({
        development_id,
        tenant_id,
        unit_number: unit_number || null,
        address: address || `Unit ${unit_number}`,
        unit_type: unit_type || 'Standard',
        purchaser_name: purchaser_name || null,
        purchaser_email: purchaser_email || null,
        purchaser_phone: purchaser_phone || null,
        handover_date: handover_date || null,
        access_code: finalAccessCode,
        status: purchaser_name ? 'sold' : 'available',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating unit:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ unit }, { status: 201 });
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
