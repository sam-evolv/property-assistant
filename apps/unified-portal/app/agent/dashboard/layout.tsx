import { AgentDashboardLayoutProvider } from './layout-provider';
import { AgentDashboardAuthGuard } from './auth-guard';
import { redirect } from 'next/navigation';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

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

  // Use admin client for data queries (bypasses RLS, avoids .single() 406 issues
  // caused by duplicate agent_profile rows).
  const admin = getSupabaseAdmin();

  const { data: profiles } = await admin
    .from('agent_profiles')
    .select('id, display_name, agency_name, agent_type')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1);

  const profile = profiles?.[0] ?? null;

  if (!profile) {
    redirect('/login/agent');
  }

  // Fetch scheme assignments with development names using admin client
  const { data: assignments } = await admin
    .from('agent_scheme_assignments')
    .select('development_id, developments(id, name)')
    .eq('agent_id', profile.id)
    .eq('is_active', true);

  const developments = (assignments ?? []).map((a: any) => ({
    id: (a.developments as any)?.id ?? a.development_id,
    name: (a.developments as any)?.name ?? 'Unknown Scheme',
  }));

  return (
    // AgentDashboardAuthGuard listens to onAuthStateChange client-side so that
    // if the session is invalidated after the initial server render (e.g. signed
    // out in another tab) the user is redirected without waiting for a full
    // server round-trip.
    <AgentDashboardAuthGuard>
      <AgentDashboardLayoutProvider profile={profile} developments={developments}>
        {children}
      </AgentDashboardLayoutProvider>
    </AgentDashboardAuthGuard>
  );
}
