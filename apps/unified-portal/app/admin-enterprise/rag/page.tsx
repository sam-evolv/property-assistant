import { requireRole } from '@/lib/supabase-server';
import dynamic from 'next/dynamic';
import { LazyLoadFallback } from '../components/LazyLoadFallback';

const RAGAnalytics = dynamic(() => import('./rag-client').then(mod => ({ default: mod.RAGAnalytics })), {
  loading: () => <LazyLoadFallback />
});

export default async function RAGPage() {
  await requireRole(['super_admin', 'admin']);

  return <RAGAnalytics />;
}
