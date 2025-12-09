import { redirect } from 'next/navigation';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { ThemeEditor } from './ThemeEditor';

export default async function ThemeConfigPage() {
  // Fixed: Use @supabase/auth-helpers-nextjs instead of missing @supabase/ssr package
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { user: authUser },
    error
  } = await supabase.auth.getUser();

  if (error || !authUser) {
    redirect('/login');
  }

  const { data: user } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('id', authUser.id)
    .single();

  if (!user || !user.tenant_id) {
    redirect('/dashboard');
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', user.tenant_id)
    .single();

  if (!tenant) {
    redirect('/dashboard');
  }

  const { createClient } = await import('@supabase/supabase-js');
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: themeConfig } = await adminClient
    .from('theme_config')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .single();

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Theme Configuration</h1>
        <p className="text-gray-600 mt-2">
          Customise your tenant portal's branding and appearance
        </p>
      </div>

      <ThemeEditor
        tenantId={user.tenant_id}
        tenantName={tenant.name}
        initialConfig={themeConfig}
      />
    </div>
  );
}
