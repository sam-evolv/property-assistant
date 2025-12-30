import { NextRequest, NextResponse } from 'next/server';
import { handleCreateDevelopment } from '@openhouse/api/developments';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db/client';
import { developments } from '@openhouse/db/schema';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'super_admin']);
    const supabaseAdmin = getSupabaseAdmin();
    
    console.log('[Developments API] Fetching developments...');
    
    let drizzleDevs: any[] = [];
    let drizzleError: Error | null = null;
    
    try {
      drizzleDevs = await db.select().from(developments).orderBy(sql`created_at DESC`);
      console.log('[Developments API] Drizzle developments:', drizzleDevs.length);
    } catch (err) {
      drizzleError = err instanceof Error ? err : new Error('Drizzle query failed');
      console.error('[Developments API] Drizzle error (falling back to Supabase):', drizzleError.message);
    }
    
    const supabaseResult = await supabaseAdmin
      .from('projects')
      .select('id, name, address, image_url, organization_id, created_at');

    console.log('[Developments API] Supabase projects:', supabaseResult.data?.length || 0);

    if (supabaseResult.error) {
      console.error('[Developments API] Supabase error:', supabaseResult.error);
    }

    const drizzleIds = new Set(drizzleDevs.map(d => d.id));
    
    const normalizedDrizzleDevs = drizzleDevs.map(d => ({
      id: d.id,
      name: d.name,
      code: d.code || d.name?.toUpperCase().replace(/\s+/g, '_').substring(0, 10) || 'DEV',
      is_active: true,
      address: d.address || null,
      image_url: null,
      source: 'drizzle' as const,
    }));

    const supabaseProjects = (supabaseResult.data || [])
      .filter(p => !drizzleIds.has(p.id))
      .map(p => ({
        id: p.id,
        name: p.name || 'Unnamed Project',
        code: p.name?.toUpperCase().replace(/\s+/g, '_').substring(0, 10) || 'PROJ',
        is_active: true,
        address: p.address || null,
        image_url: p.image_url || null,
        source: 'supabase' as const,
      }));

    const allDevelopments = [...normalizedDrizzleDevs, ...supabaseProjects];
    
    console.log('[Developments API] Total merged developments:', allDevelopments.length);
    
    return NextResponse.json({ 
      success: true, 
      developments: allDevelopments 
    });
  } catch (error) {
    console.error('[Developments API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch developments' },
      { status: 500 }
    );
  }
}

export const POST = handleCreateDevelopment;
