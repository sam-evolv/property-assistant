import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db/client';
import { developments } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const supabaseAdmin = getSupabaseAdmin();
    const canAccess = (tenantId: string | null | undefined) =>
      session.role === 'super_admin' || (!!tenantId && tenantId === session.tenantId);
    
    // Try to get from local DB first
    const [development] = await db
      .select()
      .from(developments)
      .where(eq(developments.id, params.id))
      .limit(1);

    if (development) {
      if (!canAccess(development.tenant_id)) {
        return NextResponse.json({ error: 'Development not found' }, { status: 404 });
      }
      return NextResponse.json({ development });
    }

    // Fallback: try Supabase projects table
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('id, name, tenant_id, created_at, project_type')
      .eq('id', params.id)
      .single();

    if (project && canAccess(project.tenant_id)) {
      return NextResponse.json({
        development: {
          id: project.id,
          name: project.name || 'Development',
          tenant_id: project.tenant_id,
          created_at: project.created_at,
          system_instructions: null,
          project_type: project.project_type || 'bts',
        }
      });
    }

    return NextResponse.json({ error: 'Development not found' }, { status: 404 });

  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Failed to fetch development' },
      { status: 500 }
    );
  }
}
