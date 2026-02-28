import { getServerSession } from '@/lib/supabase-server';
import { CareLayoutProvider } from './layout-provider';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Allowed roles for care installer portal access
const ALLOWED_ROLES = ['super_admin', 'installer', 'installer_admin'];

export default async function CareDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect('/login?redirectTo=/care-dashboard');
  }

  // Check role-based access
  const hasAccess = session.role && ALLOWED_ROLES.includes(session.role);

  if (!hasAccess) {
    console.warn(`[Care Dashboard] Access denied for email: ${session.email || 'unknown'}, role: ${session.role || 'none'}`);
    redirect('/unauthorized');
  }

  console.log(`[Care Dashboard] Access granted for ${session.email}, role: ${session.role}`);

  return (
    <CareLayoutProvider session={session}>
      {children}
    </CareLayoutProvider>
  );
}
