import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/supabase-server';
import { AdminEnterpriseNav } from './nav-client';

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
    <div className="flex h-screen bg-gray-50">
      <AdminEnterpriseNav />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
