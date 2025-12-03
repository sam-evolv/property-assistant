import { requireRole } from '@/lib/supabase-server';
import InsightsClient from './insights-client';

export default async function DeveloperInsightsPage() {
  const session = await requireRole(['developer', 'admin', 'super_admin']);

  return <InsightsClient tenantId={session.tenantId} />;
}
