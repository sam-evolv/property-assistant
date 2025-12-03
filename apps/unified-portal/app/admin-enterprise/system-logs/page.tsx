import { requireRole } from '@/lib/supabase-server';
import dynamic from 'next/dynamic';
import { LazyLoadFallback } from '../components/LazyLoadFallback';

const SystemLogs = dynamic(() => import('./system-logs-client').then(mod => ({ default: mod.SystemLogs })), {
  loading: () => <LazyLoadFallback />
});

export default async function SystemLogsPage() {
  await requireRole(['super_admin', 'admin']);

  return <SystemLogs />;
}
