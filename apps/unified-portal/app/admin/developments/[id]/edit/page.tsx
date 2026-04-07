import { requireRole } from '@/lib/supabase-server';
import { DevelopmentEditForm } from './form';
import { redirect, notFound } from 'next/navigation';
import { getDevelopmentById } from '@/app/actions/developments';
export const dynamic = 'force-dynamic'

export default async function EditDevelopmentPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
