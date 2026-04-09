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

  // Verify this user has an agent profile
  const { data: profile } = await supabase
    .from('agent_profiles')
    .select('id, display_name, agency_name, agent_type')
    .eq('user_id', user.id)
    .single();

  if (!profile) {
    redirect('/login/agent');
  }

  return (
    <AgentDashboardLayoutProvider profile={profile}>
      {children}
    </AgentDashboardLayoutProvider>
  );
}
