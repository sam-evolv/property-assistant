import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const revalidate = 3600;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('diagnostic_flows')
    .select(`
      id,
      name,
      description,
      system_type,
      status,
      icon,
      colour,
      steps,
      stats_started,
      stats_resolved,
      stats_escalated,
      created_at,
      updated_at
    `)
    .order('stats_started', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Map to friendlier shape
  const flows = (data || []).map((f: Record<string, unknown>) => {
    const steps = f.steps as unknown[] | null;
    return {
      id: f.id,
      flow_name: f.name,
      description: f.description,
      system_type: f.system_type,
      step_count: Array.isArray(steps) ? steps.length : 0,
      times_triggered: (f.stats_started as number) || 0,
      updated_at: f.updated_at,
    };
  });

  return NextResponse.json({ flows });
}
