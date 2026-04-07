import { requireRole } from '@/lib/supabase-server';
import nextDynamic from 'next/dynamic';
import { LazyLoadFallback } from '../components/LazyLoadFallback';
export const dynamic = 'force-dynamic'

const UnitsExplorer = nextDynamic(() => import('./units-client').then(mod => ({ default: mod.UnitsExplorer })), {
  loading: () => <LazyLoadFallback />
});

export default async function UnitsPage() {
  await requireRole(['super_admin', 'admin']);

  return <UnitsExplorer />;
}
