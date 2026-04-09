/**
 * POST /api/care/service-booking
 * Creates a service booking request for an installation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { installationId, requestedSlot, notes } = body;

    if (!installationId || !requestedSlot) {
      return NextResponse.json(
        { error: 'installationId and requestedSlot are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Verify the installation exists
    const { data: installation, error: instError } = await supabase
      .from('installations')
      .select('id, tenant_id')
      .eq('id', installationId)
      .single();

    if (instError || !installation) {
      return NextResponse.json(
        { error: 'Installation not found' },
        { status: 404 }
      );
    }

    // Insert the booking
    const { data: booking, error: insertError } = await supabase
      .from('service_bookings')
      .insert({
        installation_id: installationId,
        tenant_id: installation.tenant_id,
        requested_slot: requestedSlot,
        notes: notes || null,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to create booking' },
        { status: 500 }
      );
    }

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create service booking' },
      { status: 500 }
    );
  }
}
