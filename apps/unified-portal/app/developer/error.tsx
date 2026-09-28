'use client';

// Error boundary for the developer portal. Without it, a render exception
// anywhere under /developer falls through to Next's bare "Application error"
// screen. The sidebar layout stays mounted; only the page area is replaced.

import { useEffect } from 'react';
import Link from 'next/link';

export default function DeveloperError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[developer.segment.error]', {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-5 py-8">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9CA3AF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 className="mb-2 text-[17px] font-semibold text-gray-900">
          This page didn&apos;t load.
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-gray-500">
          Something interrupted it while loading. Try again, or head back to
          your dashboard.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-xl bg-gold-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-gold-600"
          >
            Try again
          </button>
          <Link
            href="/developer"
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
