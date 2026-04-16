import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import CareSelectClient from './CareSelectClient';

export const dynamic = 'force-dynamic';

export default async function CareSelectPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login/care');
  }

  // Admin row + tenant installations check (Care Dashboard visibility)
  const { data: adminRow } = await supabase
    .from('admins')
    .select('id, tenant_id, role')
    .eq('email', user.email!)
    .maybeSingle();

  let dashboardAvailable = false;
  if (adminRow?.tenant_id) {
    const { count } = await supabase
      .from('installations')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', adminRow.tenant_id);
    dashboardAvailable = (count ?? 0) > 0;
  }

  // Prefer the Mary Murphy / 12 Meadow Drive demo installation if the user
  // has access to it; otherwise fall back to the most recently active context.
  const DEMO_INSTALLATION_ID = '52ed7a3e-1d3d-4acb-a35e-e069fe7b0c02';

  const { data: contexts } = await supabase
    .from('user_contexts')
    .select('context_id, last_active_at')
    .eq('auth_user_id', user.id)
    .eq('product', 'care')
    .eq('context_type', 'installation');

  const demoMatch = contexts?.find((c) => c.context_id === DEMO_INSTALLATION_ID);
  const mostRecent = contexts
    ?.slice()
    .sort((a, b) => {
      const dateA = a.last_active_at ? new Date(a.last_active_at).getTime() : 0;
      const dateB = b.last_active_at ? new Date(b.last_active_at).getTime() : 0;
      return dateB - dateA;
    })[0];

  const customerHref = demoMatch
    ? `/care/${DEMO_INSTALLATION_ID}`
    : mostRecent
      ? `/care/${mostRecent.context_id}`
      : null;

  return (
    <CareSelectClient
      dashboardHref={dashboardAvailable ? '/care-dashboard' : null}
      customerHref={customerHref}
    />
  );
}
