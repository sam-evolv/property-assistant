'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

/**
 * Client-side auth guard for the agent dashboard.
 *
 * The server layout already redirects unauthenticated requests, but there is a
 * narrow window where the server renders with a valid session token that the
 * browser's Supabase client has not yet seen (e.g. right after sign-in before
 * the first onAuthStateChange SIGNED_IN event fires).  Conversely, if the user
 * signs out in another tab the server would keep rendering stale pages.
 *
 * This guard subscribes to onAuthStateChange and redirects to /login/agent
 * whenever the session is lost, matching the behaviour described in the task.
 */
export function AgentDashboardAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const hasEnv =
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    if (!hasEnv) return;

    const supabase = createClientComponentClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
        router.replace('/login/agent');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return <>{children}</>;
}
