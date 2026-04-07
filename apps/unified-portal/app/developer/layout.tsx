import { getServerSession } from '@/lib/supabase-server';
import { DeveloperLayoutProvider } from './layout-provider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { redirect } from 'next/navigation';
import { logger } from '@/lib/logger';

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
    logger.warn('[Developer Portal] Access denied', { role: session.role || 'none' });
    redirect('/unauthorized');
  }

  logger.info('[Developer Portal] Access granted', { role: session.role });

  return (
    <DeveloperLayoutProvider session={session}>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </DeveloperLayoutProvider>
  );
}
