import { requireRole } from '@/lib/supabase-server';
import { DevelopmentForm } from './form';
import { redirect } from 'next/navigation';
import { getAllTenantsForForm, getAllDevelopersForList } from '@/app/actions/developers';

export default async function NewDevelopmentPage() {
  try {
    await requireRole(['super_admin']);
  } catch {
    redirect('/unauthorized');
  }

  const [tenants, developers] = await Promise.all([
    getAllTenantsForForm(),
    getAllDevelopersForList(),
  ]);

  return <DevelopmentForm tenants={tenants} developers={developers} />;
}
