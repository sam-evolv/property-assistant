import { requireRole } from '@/lib/supabase-server';
import dynamic from 'next/dynamic';
import { LazyLoadFallback } from '../components/LazyLoadFallback';

const HomeownersDirectory = dynamic(() => import('./homeowners-client').then(mod => ({ default: mod.HomeownersDirectory })), {
  loading: () => <LazyLoadFallback />
});

export default async function HomeownersPage() {
  await requireRole(['super_admin', 'admin']);

  return <HomeownersDirectory />;
}
