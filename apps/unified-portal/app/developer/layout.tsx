import { getServerSession, createServerSupabaseClient } from '@/lib/supabase-server';
import { DeveloperLayoutProvider } from './layout-provider';
import { redirect } from 'next/navigation';
import type { AdminSession } from '@/lib/types';

export const dynamic = 'force-dynamic';

// GOD MODE: Admin emails that bypass all permission checks
const ADMIN_EMAILS = [
  'sam@evolvai.ie',
  'sam@evolv.ie',
];

export default async function DeveloperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // First try normal session
  let session = await getServerSession();
  
  // GOD MODE: If no session but user is logged in with admin email, create synthetic session
  if (!session) {
    try {
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) {
        console.log('[Developer Layout] GOD MODE: Bypassing DB role check for admin:', user.email);
        // Create synthetic admin session for the admin email
        session = {
          id: user.id,
          email: user.email,
          role: 'super_admin',
          tenantId: null,
        };
      }
    } catch (error) {
      console.error('[Developer Layout] GOD MODE check failed:', error);
    }
  }
  
  if (!session) {
    redirect('/login?redirectTo=/developer');
  }

  return (
    <DeveloperLayoutProvider session={session}>
      {children}
    </DeveloperLayoutProvider>
  );
}
