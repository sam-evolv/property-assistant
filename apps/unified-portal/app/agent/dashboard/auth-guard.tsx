'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

/**
 * Client-side auth guard for the agent dashboard.
 *
 * The server layout already redirects unauthenticated requests. This guard's
 * only job is to detect a *subsequent* sign-out (e.g. the user signs out in
 * another tab) and redirect without waiting for a server round-trip.
 *
 * Important: the Supabase browser client can fire SIGNED_OUT on initial mount
 * before it has read the session from cookies. We must NOT redirect in that
 * case — the server component already confirmed the session is valid.
 * A signedIn ref tracks whether SIGNED_IN has been observed in this page
 * lifecycle; SIGNED_OUT is only acted upon after that.
 */
export function AgentDashboardAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // Becomes true once we observe SIGNED_IN (or TOKEN_REFRESHED, which implies
  // an active session). Only after that do we treat SIGNED_OUT as a real
  // sign-out rather than the spurious initial-mount event.
  const signedInRef = useRef(false);

  useEffect(() => {
    const hasEnv =
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    if (!hasEnv) return;

    const supabase = createClientComponentClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        signedInRef.current = true;
      }

      if (event === 'SIGNED_OUT' && signedInRef.current) {
        router.replace('/login/agent');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return <>{children}</>;
}
