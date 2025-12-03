import { requireRole } from '@/lib/supabase-server';
import AnalyticsClient from './analytics-client';

export default async function DeveloperAnalyticsPage() {
  const session = await requireRole(['developer', 'admin', 'super_admin']);

  return <AnalyticsClient tenantId={session.tenantId} />;
}
