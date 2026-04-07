import { requireRole } from '@/lib/supabase-server';
import nextDynamic from 'next/dynamic';
import { LazyLoadFallback } from '../components/LazyLoadFallback';
export const dynamic = 'force-dynamic'

const HomeownersDirectory = nextDynamic(() => import('./homeowners-client').then(mod => ({ default: mod.HomeownersDirectory })), {
  loading: () => <LazyLoadFallback />
});

export default async function HomeownersPage() {
  await requireRole(['super_admin', 'admin']);

  return <HomeownersDirectory />;
}
