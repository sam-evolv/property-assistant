'use client';

/**
 * Client component for /snag/accept. On mount, POSTs the token to
 * /api/snag/accept. On success, redirects to /snag. On error, shows
 * the server's error message clearly with no retry button.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface AcceptInviteClientProps {
  token: string;
  signedInEmail: string;
}

type State =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

export function AcceptInviteClient({ token, signedInEmail }: AcceptInviteClientProps) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'idle' });

  useEffect(() => {
    if (!token) {
      setState({ kind: 'error', message: 'This invitation link is missing its token.' });
      return;
    }
    let cancelled = false;
    setState({ kind: 'submitting' });
    (async () => {
      try {
        const res = await fetch('/api/snag/accept', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (cancelled) return;
        if (res.ok) {
          setState({ kind: 'success' });
          setTimeout(() => router.push('/snag'), 800);
          return;
        }
        let message = "Couldn't accept this invitation.";
        try {
          const json = await res.json();
          if (typeof json?.error === 'string' && json.error.length > 0 && json.error.length < 200) {
            message = json.error;
          }
        } catch {
          // ignore
        }
        setState({ kind: 'error', message });
      } catch {
        if (!cancelled) setState({ kind: 'error', message: "Couldn't reach the server. Try the link again later." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full bg-white border border-neutral-200 rounded-2xl p-6 text-center">
        {state.kind === 'submitting' || state.kind === 'idle' ? (
          <>
            <div className="mx-auto w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
              <div className="w-6 h-6 rounded-full border-2 border-neutral-300 border-t-neutral-900 animate-spin" />
            </div>
            <h1 className="text-heading-sm text-neutral-900 mb-1">Accepting invitation</h1>
            <p className="text-body-sm text-neutral-600">Signing you in as {signedInEmail || 'your account'}.</p>
          </>
        ) : state.kind === 'success' ? (
          <>
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <h1 className="text-heading-sm text-neutral-900 mb-1">Invitation accepted</h1>
            <p className="text-body-sm text-neutral-600">Taking you to the snag form.</p>
          </>
        ) : (
          <>
            <div className="mx-auto w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h1 className="text-heading-sm text-neutral-900 mb-2">Could not accept</h1>
            <p className="text-body-sm text-neutral-600 mb-4">{state.message}</p>
            <p className="text-caption text-neutral-500">Ask your admin to send a new invitation.</p>
          </>
        )}
      </div>
    </div>
  );
}
