import { requireRole } from '@/lib/supabase-server';
import { DeveloperForm } from './form';
import { redirect } from 'next/navigation';
import { getAllTenantsForForm } from '@/app/actions/developers';

export default async function NewDeveloperPage() {
  try {
    await requireRole(['super_admin']);
  } catch {
    redirect('/unauthorized');
  }

  const tenants = await getAllTenantsForForm();

  return <DeveloperForm tenants={tenants} />;
}
