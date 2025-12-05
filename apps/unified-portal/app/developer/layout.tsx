import { getServerSession } from '@/lib/supabase-server';
import { DeveloperLayoutProvider } from './layout-provider';
import { redirect } from 'next/navigation';

export default async function DeveloperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  
  if (!session) {
    redirect('/login?redirectTo=/developer');
  }

  return (
    <DeveloperLayoutProvider session={session}>
      {children}
    </DeveloperLayoutProvider>
  );
}
