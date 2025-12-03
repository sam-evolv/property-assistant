import { requireRole } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { HomeownerForm } from './form';
import { getAllDevelopmentsForList } from '@/app/actions/developments';

export default async function NewHomeownerPage() {
  try {
    await requireRole(['developer', 'super_admin']);
  } catch {
    redirect('/unauthorized');
  }

  const developments = await getAllDevelopmentsForList();

  return <HomeownerForm developments={developments} />;
}
