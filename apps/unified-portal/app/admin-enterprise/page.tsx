import { requireRole } from '@/lib/supabase-server';
import nextDynamic from 'next/dynamic';
import { LazyLoadFallback } from './components/LazyLoadFallback';

export const dynamic = 'force-dynamic';

const OverviewDashboard = nextDynamic(() => import('./overview-client').then(mod => ({ default: mod.OverviewDashboard })), {
  loading: () => <LazyLoadFallback />
});

export default async function AdminEnterprisePage() {
  await requireRole(['super_admin', 'admin']);

  return <OverviewDashboard />;
}
