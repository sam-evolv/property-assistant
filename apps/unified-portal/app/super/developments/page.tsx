import { Suspense } from 'react';
import { requireRole } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';
import { DevelopmentsSkeleton } from './DevelopmentsSkeleton';

const DevelopmentsContent = dynamic(
  () => import('./DevelopmentsContent').then((mod) => ({ default: mod.DevelopmentsContent })),
  {
    loading: () => <DevelopmentsSkeleton />,
  }
);

export default async function DevelopmentsPage() {
  let session;
  try {
    session = await requireRole(['super_admin', 'admin']);
  } catch (error) {
    redirect('/unauthorized');
  }

  const isSuperAdmin = session.role === 'super_admin';

  return (
    <Suspense fallback={<DevelopmentsSkeleton />}>
      <DevelopmentsContent isSuperAdmin={isSuperAdmin} />
    </Suspense>
  );
}
