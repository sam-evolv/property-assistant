import { requireRole } from '@/lib/supabase-server';
import { SuperAdminDashboardClient } from './dashboard-client';
import { redirect } from 'next/navigation';
import { getAllDevelopersForList } from '@/app/actions/developers';
import { getAllDevelopmentsForList } from '@/app/actions/developments';

export const dynamic = 'force-dynamic';

export default async function SuperAdminDashboard() {
  let session;
  
  try {
    session = await requireRole(['super_admin']);
  } catch (error) {
    redirect('/unauthorized');
  }

  const [developers, developments] = await Promise.all([
    getAllDevelopersForList(),
    getAllDevelopmentsForList(),
  ]);

  return <SuperAdminDashboardClient session={session} developers={developers} developments={developments} />;
}
