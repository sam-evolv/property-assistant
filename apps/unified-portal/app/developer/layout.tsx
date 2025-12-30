import { getServerSession } from '@/lib/supabase-server';
import { DeveloperLayoutProvider } from './layout-provider';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DeveloperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  
  if (!session) {
    redirect('/login?redirectTo=/developer');
  }

  const allowedRoles = ['developer', 'admin', 'tenant_admin', 'super_admin'];
  const hasAccess = session.roles?.some(role => allowedRoles.includes(role)) || 
                    allowedRoles.includes(session.role);
  
  if (!hasAccess) {
    console.warn(`[Developer Portal] Access denied for email: ${session.email || 'unknown'}, roles: ${session.roles}`);
    redirect('/unauthorized');
  }

  return (
    <DeveloperLayoutProvider session={session}>
      {children}
    </DeveloperLayoutProvider>
  );
}
