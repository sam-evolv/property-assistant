import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { InstallationsClient } from './installations-client';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false }, db: { schema: 'public' } }
  );
}

export default async function InstallationsPage() {
  let session;
  try {
    session = await requireRole(['installer', 'installer_admin', 'super_admin']);
  } catch {
    return <InstallationsClient installations={[]} error="You do not have permission to view this page." />;
  }

  const tenantId = session.tenantId;
  const supabase = getSupabaseAdmin();

  try {
    const { data, error: fetchError } = await supabase
      .from('installations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('install_date', { ascending: false });

    if (fetchError) {
      console.error('[Installations] Fetch error:', fetchError);
      return <InstallationsClient installations={[]} error="Failed to load installations." />;
    }

    const mapped = (data || []).map((inst: any) => ({
      id: inst.id,
      jobRef: inst.job_reference,
      firstName: inst.customer_name?.split(' ')[0] || '',
      lastName: inst.customer_name?.split(' ').slice(1).join(' ') || '',
      address: `${inst.address_line_1 || ''}${inst.city ? ', ' + inst.city : ''}`,
      region: inst.region || inst.county || 'Unknown',
      systemSize: inst.system_size_kwp || 0,
      systemType: inst.system_type || 'solar_pv',
      inverter: inst.inverter_model || '',
      installedDate: inst.install_date,
      portalStatus: inst.portal_status === 'active' ? 'Active' as const : inst.portal_status === 'pending' ? 'Pending' as const : 'Inactive' as const,
      health: (inst.health_status || 'healthy') as 'healthy' | 'issue' | 'pending',
      source: inst.source === 'development' ? 'Dev' as const : 'Private' as const,
      email: inst.customer_email || '',
      phone: inst.customer_phone || '',
      lastActivity: '',
      activityTimeline: [] as { message: string; time: string; dotColor: string }[],
    }));

    return <InstallationsClient installations={mapped} />;
  } catch (err: any) {
    console.error('[Installations] Error:', err);
    return <InstallationsClient installations={[]} error="Failed to load installations. Please refresh the page." />;
  }
}
