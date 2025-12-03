import { requireRole } from '@/lib/supabase-server';
import dynamic from 'next/dynamic';
import { LazyLoadFallback } from '../components/LazyLoadFallback';

const UnitsExplorer = dynamic(() => import('./units-client').then(mod => ({ default: mod.UnitsExplorer })), {
  loading: () => <LazyLoadFallback />
});

export default async function UnitsPage() {
  await requireRole(['super_admin', 'admin']);

  return <UnitsExplorer />;
}
