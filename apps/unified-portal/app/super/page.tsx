import { Suspense } from 'react';
import { requireRole } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import SuperDashboardWrapper from './SuperDashboardWrapper';

export const dynamic = 'force-dynamic';

export default async function AdminEnterprisePage() {
  try {
    await requireRole(['super_admin', 'admin']);
  } catch (error) {
    redirect('/unauthorized');
  }

  return (
    <Suspense fallback={
      <div className="p-8 min-h-screen bg-neutral-50 animate-pulse">
        <div className="max-w-[1600px] mx-auto">
          <div className="h-8 w-64 bg-neutral-200 rounded-lg mb-8" />
          <div className="bg-white rounded-xl border border-neutral-200 h-96" />
        </div>
      </div>
    }>
      <SuperDashboardWrapper />
    </Suspense>
  );
}
