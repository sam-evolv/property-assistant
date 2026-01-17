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
    console.warn(`[Developer Portal] Access denied for email: ${session.email || 'unknown'}, role: ${session.role || 'none'}`);
    redirect('/unauthorized');
  }

  console.log(`[Developer Portal] Access granted for ${session.email}, role: ${session.role}`);

  return (
    <DeveloperLayoutProvider session={session}>
      {children}
    </DeveloperLayoutProvider>
  );
}
