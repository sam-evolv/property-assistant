import { AgentDashboardLayoutProvider } from './layout-provider';
import { AgentDashboardAuthGuard } from './auth-guard';
import { redirect } from 'next/navigation';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function AgentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Capture cookie store synchronously before any await — required for
  // @supabase/auth-helpers-nextjs to read refreshed tokens written by middleware.
  const cookieStore = cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });
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
    // AgentDashboardAuthGuard listens to onAuthStateChange client-side so that
    // if the session is invalidated after the initial server render (e.g. signed
    // out in another tab) the user is redirected without waiting for a full
    // server round-trip.
    <AgentDashboardAuthGuard>
      <AgentDashboardLayoutProvider profile={profile}>
        {children}
      </AgentDashboardLayoutProvider>
    </AgentDashboardAuthGuard>
  );
}
