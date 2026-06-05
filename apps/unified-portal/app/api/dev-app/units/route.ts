import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/dev-app/units
 * The developer's units across all developments they own. Powers the live units
 * list in the dev-app so a unit (and its snags / HPI file / guide) is reachable.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: devs } = await supabase
      .from('developments')
      .select('id, name')
      .eq('developer_user_id', user.id);

    const devList = devs ?? [];
    const devIds = devList.map((d: any) => d.id);
    const devNames: Record<string, string> = Object.fromEntries(
      devList.map((d: any) => [d.id, d.name]),
    );
    if (devIds.length === 0) return NextResponse.json({ units: [] });

    const { data: units } = await supabase
      .from('units')
      .select('id, unit_number, address_line_1, development_id')
      .in('development_id', devIds)
      .order('unit_number');

    const result = (units ?? []).map((u: any) => ({
      id: u.id,
      unit_number: u.unit_number,
      address_line_1: u.address_line_1,
      development_id: u.development_id,
      development_name: devNames[u.development_id] ?? '',
    }));

    return NextResponse.json({ units: result });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
