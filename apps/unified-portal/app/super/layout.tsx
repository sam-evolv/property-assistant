import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/supabase-server';
import { SuperLayoutClient } from './super-layout-client';

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

  return <SuperLayoutClient>{children}</SuperLayoutClient>;
}
