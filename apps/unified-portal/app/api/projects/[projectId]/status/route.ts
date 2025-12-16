import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service role client bypasses RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
    db: { schema: 'public' }
  }
);

export async function GET(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const { projectId } = params;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Query Supabase with service role - should bypass RLS
    const [projectResult, unitTypesResult, unitsResult] = await Promise.all([
      supabaseAdmin
        .from('projects')
        .select('id, name, address, image_url')
        .eq('id', projectId)
        .single(),
      supabaseAdmin
        .from('unit_types')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId),
      // Use select('*') instead of select('id') to ensure we get a proper count
      supabaseAdmin
        .from('units')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId),
    ]);

    if (projectResult.error) {
      console.error('[Status API] Project not found:', projectId, projectResult.error);
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const unitTypesCount = unitTypesResult.count || 0;
    const unitsCount = unitsResult.count || 0;

    console.log(`[Status API] Project ${projectId}: ${unitsCount} units (error: ${unitsResult.error?.message || 'none'}), ${unitTypesCount} unit types`);

    const isSetupComplete = unitTypesCount > 0 && unitsCount > 0;
    const setupRequired = !isSetupComplete;

    return NextResponse.json({
      project: projectResult.data,
      unitTypesCount,
      unitsCount,
      isSetupComplete,
      setupRequired,
    });
  } catch (err) {
    console.error('[API /projects/[projectId]/status] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch project status' },
      { status: 500 }
    );
  }
}
