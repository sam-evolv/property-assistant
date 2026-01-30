import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const developmentId = searchParams.get('development_id');

  try {
    let query = supabaseAdmin
      .from('units')
      .select('*', { count: 'exact', head: true });

    if (developmentId) {
      query = query.eq('development_id', developmentId);
    }

    const { count, error } = await query;

    if (error) {
      console.error('Error counting units:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ count: count || 0 });
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
