'use client';

// Error boundary for the homeowner Care segment. Catches throws from
// /care/[installationId]/layout.tsx and below.
//
// Without this boundary, an exception during RSC streaming from the layout's
// Supabase call would surface as a gateway-level 503 with no UI fallback and
// no useful client-side error. The audit (Care Batch 1.5) caught exactly
// that pattern: `/care/[id]?_rsc=...` returning 503 with the renderer
// frozen waiting for the stream.
//
// Copy is Irish service-person voice: direct, no filler, no apology.

import { useEffect } from 'react';

export default function CareError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Best-effort browser-side log so a regression is visible in the
    // browser console even if the server log was lost.
    console.error('[care.segment.error]', {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#FAFAFA',
        padding: '32px 20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 360,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: '#FFF',
            border: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
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
        <h1
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: '#111827',
            margin: '0 0 8px',
          }}
        >
          Your portal didn't load.
        </h1>
        <p
          style={{
            fontSize: 14,
            color: '#6B7280',
            margin: '0 0 24px',
            lineHeight: 1.5,
          }}
        >
          The connection to your installer's records dropped. Try again. If it
          keeps failing, your installer will know about it from their side.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: '#D4AF37',
            color: '#FFF',
            border: 'none',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
