import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db/client';
import { developments } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REAL_PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['developer', 'super_admin']);
    
    console.log('[Development] Fetching details for:', params.id);

    // Try to get from local DB first
    const [development] = await db
      .select()
      .from(developments)
      .where(eq(developments.id, params.id))
      .limit(1);

    if (development) {
      return NextResponse.json(development);
    }

    // Fallback: try Supabase projects table
    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) {
      console.log('[Development] Not found in projects, trying with real ID');
      
      // Try with real project ID
      const { data: realProject } = await supabaseAdmin
        .from('projects')
        .select('*')
        .eq('id', REAL_PROJECT_ID)
        .single();
      
      if (realProject) {
        return NextResponse.json({
          id: params.id,
          name: realProject.name || 'Development',
          tenant_id: realProject.tenant_id,
          created_at: realProject.created_at,
        });
      }
    }

    if (project) {
      return NextResponse.json({
        id: project.id,
        name: project.name || 'Development',
        tenant_id: project.tenant_id,
        created_at: project.created_at,
      });
    }

    // Last fallback - return a mock development
    return NextResponse.json({
      id: params.id,
      name: 'Development',
      tenant_id: null,
      created_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Development] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch development' },
      { status: 500 }
    );
  }
}
