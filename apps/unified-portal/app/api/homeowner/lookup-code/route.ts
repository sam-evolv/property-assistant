export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * POST /api/homeowner/lookup-code
 *
 * Looks up a unit by its property code (unit_uid, e.g. AV-003-CFA4).
 * Returns unit details for the confirmation screen, or an alreadyRegistered
 * flag if someone has already claimed this unit.
 *
 * Body: { code: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawCode = body.code;

    if (!rawCode || typeof rawCode !== 'string') {
      return NextResponse.json({ error: 'Property code required' }, { status: 400 });
    }

    const code = rawCode.trim().toUpperCase();

    if (code.length < 3) {
      return NextResponse.json({ error: 'Code not found. Check your handover pack.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: unit, error } = await supabase
      .from('units')
      .select('id, address_line_1, purchaser_name, user_id, development_id')
      .eq('unit_uid', code)
      .single();

    if (error || !unit) {
      return NextResponse.json(
        { error: 'Code not found. Check your handover pack.' },
        { status: 400 }
      );
    }

    if (unit.user_id) {
      // Already registered — tell the client to show the sign-in screen
      return NextResponse.json({ alreadyRegistered: true });
    }

    return NextResponse.json({
      unitId: unit.id,
      address: unit.address_line_1,
      name: unit.purchaser_name,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[LOOKUP CODE]', message);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
