import { requireRole } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import AnalyticsClient from './analytics-client';

export default async function AnalyticsPage() {
  try {
    await requireRole(['super_admin']);
  } catch {
    redirect('/unauthorized');
  }

  return <AnalyticsClient />;
}
