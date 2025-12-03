import { requireRole } from '@/lib/supabase-server';
import AnalyticsClient from './analytics-client';

export default async function AnalyticsPage() {
  const session = await requireRole(['super_admin', 'admin']);

  return <AnalyticsClient tenantId={session.tenantId} />;
}
