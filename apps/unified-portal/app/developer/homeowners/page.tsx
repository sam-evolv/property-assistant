import { requireRole } from '@/lib/supabase-server';
import { HomeownersList } from './list';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

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
  const supabaseAdmin = getSupabaseAdmin();
  
  try {
    // Fetch units from Supabase where the data actually lives
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
    
    // Fetch projects for development info
    const { data: projects } = await supabaseAdmin.from('projects').select('*');
    const projectsMap = new Map((projects || []).map((p: any) => [p.id, p]));
    
    // Enrich units with development info
    unitsData = unitsData.map((u: any) => ({
      ...u,
      development: projectsMap.get(u.project_id) || null,
      development_id: u.project_id,
    }));
    
    if (searchParams.developmentId) {
      developmentData = projectsMap.get(searchParams.developmentId) || null;
    } else if (unitsData.length > 0 && unitsData[0].development) {
      developmentData = unitsData[0].development;
    }
    
    console.log(`[HomeownersPage] Loaded ${unitsData.length} units from Supabase`);
  } catch (error) {
    console.error('Failed to fetch units:', error);
  }

  return (
    <HomeownersList 
      session={session} 
      homeowners={unitsData} 
      development={developmentData}
      developmentId={searchParams.developmentId} 
    />
  );
}
