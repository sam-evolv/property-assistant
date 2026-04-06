/**
 * POST /api/care/dismiss-alert
 * Removes a dismissed alert from the installation's active_safety_alerts JSONB array.
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
    const { alertId, installationId } = body;

    if (!alertId || !installationId) {
      return NextResponse.json(
        { error: 'alertId and installationId are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch current active_safety_alerts
    const { data: installation, error: fetchError } = await supabase
      .from('installations')
      .select('id, active_safety_alerts')
      .eq('id', installationId)
      .single();

    if (fetchError || !installation) {
      return NextResponse.json(
        { error: 'Installation not found' },
        { status: 404 }
      );
    }

    const currentAlerts: Array<Record<string, unknown>> =
      Array.isArray(installation.active_safety_alerts)
        ? installation.active_safety_alerts
        : [];

    // Remove the dismissed alert by id
    const updatedAlerts = currentAlerts.filter(
      (alert) => alert.id !== alertId && alert.alert_id !== alertId
    );

    // Update the installation
    const { error: updateError } = await supabase
      .from('installations')
      .update({ active_safety_alerts: updatedAlerts })
      .eq('id', installationId);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to dismiss alert' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      remaining_alerts: updatedAlerts.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to dismiss alert' },
      { status: 500 }
    );
  }
}
