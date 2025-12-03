import { requireRole } from '@/lib/supabase-server';
import { DevelopmentEditForm } from './form';
import { redirect, notFound } from 'next/navigation';
import { getDevelopmentById } from '@/app/actions/developments';

export default async function EditDevelopmentPage({ params }: { params: { id: string } }) {
  try {
    await requireRole(['super_admin']);
  } catch {
    redirect('/unauthorized');
  }

  const development = await getDevelopmentById(params.id);

  if (!development) {
    notFound();
  }

  return <DevelopmentEditForm development={development} />;
}
