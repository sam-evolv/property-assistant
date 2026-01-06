import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SchemeSetupForm } from './form';

export default async function SchemeSetupPage({
  params,
}: {
  params: { schemeId: string };
}) {
  const cookieStore = cookies();
  const role = cookieStore.get('user_role')?.value;
  const tenantId = cookieStore.get('tenant_id')?.value;
  
  if (!role || !tenantId) {
    redirect('/login');
  }
  
  if (role !== 'developer' && role !== 'admin' && role !== 'super_admin') {
    redirect('/dashboard');
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SchemeSetupForm schemeId={params.schemeId} />
      </div>
    </div>
  );
}
