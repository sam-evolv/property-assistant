import { requireRole } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { DeveloperEditForm } from './form';
import { getDeveloperById } from '@/app/actions/developers';
import { db } from '@openhouse/db/client';
import { tenants } from '@openhouse/db/schema';

export default async function EditDeveloperPage({ params }: { params: { id: string } }) {
  try {
    await requireRole(['super_admin']);
  } catch {
    redirect('/unauthorized');
  }

  const developer = await getDeveloperById(params.id);

  if (!developer) {
    redirect('/admin');
  }

  const allTenants = await db.query.tenants.findMany({
    columns: {
      id: true,
      name: true,
      slug: true,
    },
  });

  return <DeveloperEditForm developer={developer} tenants={allTenants} />;
}
