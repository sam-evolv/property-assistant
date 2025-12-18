import { getServerSession } from '@/lib/supabase-server';
import { DeveloperLayoutProvider } from './layout-provider';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = [
  'sam@evolv.ie',
  'sam@evolvai.ie',
];

export default async function DeveloperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  
  if (!session) {
    redirect('/login?redirectTo=/developer');
  }

  const userEmail = session.email?.toLowerCase();
  const isAdmin = userEmail && ADMIN_EMAILS.some(email => email.toLowerCase() === userEmail);
  
  if (!isAdmin) {
    console.warn(`[Developer Portal] Access denied for email: ${userEmail || 'unknown'}`);
    redirect('/unauthorized');
  }

  return (
    <DeveloperLayoutProvider session={session}>
      {children}
    </DeveloperLayoutProvider>
  );
}
