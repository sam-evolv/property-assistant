import { requireRole } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import TrainingJobsClientWrapper from './TrainingJobsClientWrapper';
export const dynamic = 'force-dynamic'

export default async function TrainingJobsPage() {
  try {
    await requireRole(['super_admin', 'admin']);
  } catch (error) {
    redirect('/unauthorized');
  }

  return (
    <Suspense fallback={
      <div className="p-6 lg:p-8 bg-neutral-50 min-h-screen animate-pulse">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-8 w-72 bg-neutral-200 rounded-lg" />
          <div className="bg-white rounded-xl border border-neutral-200 h-96" />
        </div>
      </div>
    }>
      <TrainingJobsClientWrapper />
    </Suspense>
  );
}
