import { getServerSession } from '@/lib/supabase-server';
import { DeveloperLayoutProvider } from './layout-provider';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Allowed roles for developer portal access
const ALLOWED_ROLES = ['super_admin', 'developer', 'admin'];

export default async function DeveloperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect('/login?redirectTo=/developer');
  }

  // Check role-based access
  const hasAccess = session.role && ALLOWED_ROLES.includes(session.role);

  if (!hasAccess) {
    redirect('/unauthorized');
  }

  return (
    <DeveloperLayoutProvider session={session}>
      {children}
    </DeveloperLayoutProvider>
  );
}
