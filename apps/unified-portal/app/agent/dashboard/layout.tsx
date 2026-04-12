import { AgentDashboardLayoutProvider } from './layout-provider';
import { redirect } from 'next/navigation';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function AgentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerComponentClient({ cookies });
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login/agent');
  }

  // Use order + limit instead of .single() because a user may have multiple agent profiles
  const { data: profiles } = await supabase
    .from('agent_profiles')
    .select('id, display_name, agency_name, agent_type')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1);

  const profile = profiles?.[0] ?? null;

  if (!profile) {
    redirect('/login/agent');
  }

  // Fetch scheme assignments with development names
  const { data: assignments } = await supabase
    .from('agent_scheme_assignments')
    .select('development_id, developments(id, name)')
    .eq('agent_id', profile.id)
    .eq('is_active', true);

  const developments = (assignments ?? []).map((a: any) => ({
    id: (a.developments as any)?.id ?? a.development_id,
    name: (a.developments as any)?.name ?? 'Unknown Scheme',
  }));

  return (
    <AgentDashboardLayoutProvider profile={profile} developments={developments}>
      {children}
    </AgentDashboardLayoutProvider>
  );
}
