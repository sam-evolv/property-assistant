import { requireRole } from '@/lib/supabase-server';
import DeveloperDashboardClient from './developer-client';

export default async function DeveloperDashboard() {
  const session = await requireRole(['developer', 'admin', 'super_admin']);

  return <DeveloperDashboardClient tenantId={session.tenantId} />;
}
