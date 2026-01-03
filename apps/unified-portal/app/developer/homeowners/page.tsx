import { requireRole } from '@/lib/supabase-server';
import { HomeownersList } from './list';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      db: { schema: 'public' }
    }
  );
}

async function getAcknowledgedUnits(): Promise<Map<string, number>> {
  try {
    // Get the latest docs_version for each unit from purchaser_agreements
    const result = await db.execute(sql`
      SELECT DISTINCT ON (unit_id) unit_id, docs_version
      FROM purchaser_agreements 
      WHERE unit_id IS NOT NULL
      ORDER BY unit_id, agreed_at DESC
    `);
    const map = new Map<string, number>();
    for (const row of result.rows as any[]) {
      map.set(row.unit_id, row.docs_version || 1);
    }
    return map;
  } catch (error) {
    console.log('[HomeownersPage] Could not fetch purchaser_agreements (table may not exist)');
    return new Map();
  }
}

export default async function HomeownersPage({ 
  searchParams 
}: { 
  searchParams: { developmentId?: string } 
}) {
  let session;
  
  try {
    session = await requireRole(['developer', 'super_admin']);
  } catch {
    redirect('/unauthorized');
  }

  let unitsData: any[] = [];
  let developmentData: any = null;
  let allProjects: any[] = [];
  const supabaseAdmin = getSupabaseAdmin();
  
  try {
    // Fetch all projects first for the dropdown
    const { data: projects } = await supabaseAdmin.from('projects').select('*').order('name');
    allProjects = projects || [];
    const projectsMap = new Map(allProjects.map((p: any) => [p.id, p]));
    
    // Fetch units from Supabase - filter by developmentId if provided
    let unitsQuery = supabaseAdmin.from('units').select('*').order('created_at', { ascending: false });
    
    if (searchParams.developmentId) {
      unitsQuery = unitsQuery.eq('project_id', searchParams.developmentId);
    }
    
    const { data: units, error: unitsError } = await unitsQuery;
    
    if (unitsError) {
      console.error('Failed to fetch units from Supabase:', unitsError);
    } else {
      unitsData = units || [];
    }
    
    // Fetch acknowledged unit data from purchaser_agreements table
    const acknowledgedUnits = await getAcknowledgedUnits();
    console.log(`[HomeownersPage] Found ${acknowledgedUnits.size} acknowledged units in purchaser_agreements`);
    
    // Enrich units with development info and acknowledgement status
    unitsData = unitsData.map((u: any) => ({
      ...u,
      development: projectsMap.get(u.project_id) || null,
      development_id: u.project_id,
      // Set acknowledged status from purchaser_agreements table with actual docs_version
      important_docs_agreed_version: acknowledgedUnits.get(u.id) || u.important_docs_agreed_version || 0,
    }));
    
    if (searchParams.developmentId) {
      developmentData = projectsMap.get(searchParams.developmentId) || null;
    } else if (unitsData.length > 0 && unitsData[0].development) {
      developmentData = unitsData[0].development;
    }
    
    console.log(`[HomeownersPage] Loaded ${unitsData.length} units from Supabase, ${allProjects.length} projects`);
  } catch (error) {
    console.error('Failed to fetch units:', error);
  }

  return (
    <HomeownersList 
      session={session} 
      homeowners={unitsData} 
      development={developmentData}
      developmentId={searchParams.developmentId}
      allProjects={allProjects}
    />
  );
}
