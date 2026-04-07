import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/supabase-server';
import { SuperLayoutClient } from './super-layout-client';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const dynamic = 'force-dynamic';

export default async function AdminEnterpriseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireRole(['super_admin', 'admin']);
  } catch (error) {
    redirect('/unauthorized');
  }

  return (
    <ErrorBoundary>
      <SuperLayoutClient>{children}</SuperLayoutClient>
    </ErrorBoundary>
  );
}
