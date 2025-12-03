import { requireRole } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { HomeownerEditForm } from './form';
import { getHomeownerById } from '@/app/actions/homeowners';
import { getAllDevelopmentsForList } from '@/app/actions/developments';

export default async function EditHomeownerPage({ params }: { params: { id: string } }) {
  try {
    await requireRole(['developer', 'super_admin']);
  } catch {
    redirect('/unauthorized');
  }

  const [homeowner, developments] = await Promise.all([
    getHomeownerById(params.id),
    getAllDevelopmentsForList(),
  ]);

  if (!homeowner) {
    redirect('/dashboard/homeowners');
  }

  return <HomeownerEditForm homeowner={homeowner} developments={developments} />;
}
