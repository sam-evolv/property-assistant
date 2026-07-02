'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error to the console/monitoring; the digest links it to server logs.
    console.error('[app error boundary]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 ring-1 ring-red-500/30">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-white">Something went wrong</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-400">
          An unexpected error occurred. You can try again, and if it keeps
          happening please let us know.
        </p>
        {error?.digest && (
          <p className="mt-2 font-mono text-xs text-neutral-600">Ref: {error.digest}</p>
        )}
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-gold-500 px-5 text-sm font-medium text-neutral-900 transition-colors hover:bg-gold-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-white/15 px-5 text-sm font-medium text-neutral-200 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
