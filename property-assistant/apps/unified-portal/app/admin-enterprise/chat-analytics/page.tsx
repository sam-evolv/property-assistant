import { requireRole } from '@/lib/supabase-server';
import dynamic from 'next/dynamic';
import { LazyLoadFallback } from '../components/LazyLoadFallback';

const ChatAnalytics = dynamic(() => import('./chat-analytics-client').then(mod => ({ default: mod.ChatAnalytics })), {
  loading: () => <LazyLoadFallback />
});

export default async function ChatAnalyticsPage() {
  await requireRole(['super_admin', 'admin']);

  return <ChatAnalytics />;
}
