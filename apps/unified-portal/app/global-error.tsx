'use client';

// Last-resort boundary: replaces the root layout when the layout itself
// throws, so it must render its own <html>/<body> and can't rely on
// globals.css being loaded.

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global.error]', {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FAFAFA',
          padding: '32px 20px',
          boxSizing: 'border-box',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ maxWidth: 360, width: '100%', textAlign: 'center' }}>
          <h1 style={{ fontSize: 17, fontWeight: 600, color: '#111827', margin: '0 0 8px' }}>
            OpenHouse didn&apos;t load.
          </h1>
          <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 24px', lineHeight: 1.5 }}>
            Something interrupted the page while it was loading. Try again.
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
      </body>
    </html>
  );
}
