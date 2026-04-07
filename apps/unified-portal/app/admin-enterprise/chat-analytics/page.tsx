import { requireRole } from '@/lib/supabase-server';
import nextDynamic from 'next/dynamic';
import { LazyLoadFallback } from '../components/LazyLoadFallback';
export const dynamic = 'force-dynamic'

const ChatAnalytics = nextDynamic(() => import('./chat-analytics-client').then(mod => ({ default: mod.ChatAnalytics })), {
  loading: () => <LazyLoadFallback />
});

export default async function ChatAnalyticsPage() {
  await requireRole(['super_admin', 'admin']);

  return <ChatAnalytics />;
}
