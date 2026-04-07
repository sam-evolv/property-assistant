import { requireRole } from '@/lib/supabase-server';
import nextDynamic from 'next/dynamic';
import { LazyLoadFallback } from '../components/LazyLoadFallback';
export const dynamic = 'force-dynamic'

const RAGAnalytics = nextDynamic(() => import('./rag-client').then(mod => ({ default: mod.RAGAnalytics })), {
  loading: () => <LazyLoadFallback />
});

export default async function RAGPage() {
  await requireRole(['super_admin', 'admin']);

  return <RAGAnalytics />;
}
