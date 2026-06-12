export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, requireRole } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const developmentId = searchParams.get('development_id');

  try {
    // SECURITY: Super admin only — cross-tenant unit counts by design
    await requireRole(['super_admin']);

    const supabaseAdmin = getSupabaseAdmin();
    
    let query = supabaseAdmin
      .from('units')
      .select('*', { count: 'exact', head: true });

    if (developmentId) {
      query = query.eq('development_id', developmentId);
    }

    const { count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ count: count || 0 });
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : 'Unknown error';
    if (errMessage === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (errMessage === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
