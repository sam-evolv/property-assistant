import { requireRole } from '@/lib/supabase-server';
import dynamic from 'next/dynamic';
import { LazyLoadFallback } from './components/LazyLoadFallback';

const OverviewDashboard = dynamic(() => import('./overview-client').then(mod => ({ default: mod.OverviewDashboard })), {
  loading: () => <LazyLoadFallback />
});

export default async function AdminEnterprisePage() {
  await requireRole(['super_admin', 'admin']);

  return <OverviewDashboard />;
}
