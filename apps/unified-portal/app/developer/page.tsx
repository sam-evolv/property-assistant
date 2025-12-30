import { requireRole } from '@/lib/supabase-server';
import DeveloperDashboardClient from './developer-client';

export const dynamic = 'force-dynamic';

export default async function DeveloperDashboard() {
  const session = await requireRole(['developer', 'admin', 'tenant_admin', 'super_admin']);

  return <DeveloperDashboardClient tenantId={session.tenantId} />;
}
