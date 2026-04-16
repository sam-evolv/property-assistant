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

  // Most recent care installation context (My Energy System visibility)
  const { data: ctx } = await supabase
    .from('user_contexts')
    .select('context_id')
    .eq('auth_user_id', user.id)
    .eq('product', 'care')
    .eq('context_type', 'installation')
    .order('last_active_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const customerHref = ctx?.context_id ? `/care/${ctx.context_id}` : null;

  return (
    <CareSelectClient
      dashboardHref={dashboardAvailable ? '/care-dashboard' : null}
      customerHref={customerHref}
    />
  );
}
