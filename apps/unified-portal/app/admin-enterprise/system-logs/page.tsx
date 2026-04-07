import { requireRole } from '@/lib/supabase-server';
import nextDynamic from 'next/dynamic';
import { LazyLoadFallback } from '../components/LazyLoadFallback';
export const dynamic = 'force-dynamic'

const SystemLogs = nextDynamic(() => import('./system-logs-client').then(mod => ({ default: mod.SystemLogs })), {
  loading: () => <LazyLoadFallback />
});

export default async function SystemLogsPage() {
  await requireRole(['super_admin', 'admin']);

  return <SystemLogs />;
}
