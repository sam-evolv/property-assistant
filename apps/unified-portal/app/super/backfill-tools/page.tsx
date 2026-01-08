import { requireRole } from '@/lib/supabase-server';
import dynamic from 'next/dynamic';
import { LazyLoadFallback } from '../components/LazyLoadFallback';

const BackfillTools = dynamic(() => import('./backfill-tools-client').then(mod => ({ default: mod.BackfillTools })), {
  loading: () => <LazyLoadFallback />
});

export default async function BackfillToolsPage() {
  await requireRole(['super_admin']);

  return <BackfillTools />;
}
