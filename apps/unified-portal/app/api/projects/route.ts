import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: projects, error } = await supabaseAdmin
      .from('projects')
      .select('id, name, address, image_url, organization_id, created_at')
      .order('name', { ascending: true });

    if (error) {
      console.error('[API /projects] Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[API /projects] Found projects:', projects?.length || 0);

    return NextResponse.json({ projects: projects || [] });
  } catch (err) {
    console.error('[API /projects] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}
