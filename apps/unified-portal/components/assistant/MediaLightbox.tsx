'use client';

/**
 * Full screen image overlay for assistant media. Sprint 1 of Assistant V2.
 *
 * Renders the signed full-resolution URL on a dimmed backdrop with a single
 * close affordance. The signed URL is fetched lazily via
 * /api/assistant/media/signed-url so the caller does not have to keep
 * URLs alive once a message is in the chat history.
 *
 * Closes on:
 *   - Escape
 *   - backdrop click
 *   - the close button
 *
 * Focus is trapped on the close button while the overlay is open. The
 * underlying chat scroll is locked via body overflow.
 */

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface MediaLightboxProps {
  mediaId: string | null;
  qrToken: string;
  thumbnailUrl?: string | null;
  onClose: () => void;
}

export function MediaLightbox({
  mediaId,
  qrToken,
  thumbnailUrl,
  onClose,
}: MediaLightboxProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mediaId) return;
    let cancelled = false;
    setSignedUrl(null);
    setError(null);

    (async () => {
      try {
        const res = await fetch('/api/assistant/media/signed-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-qr-token': qrToken,
          },
          body: JSON.stringify({ media_id: mediaId }),
        });
        if (!res.ok) {
          if (!cancelled) setError('Could not load that photo.');
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        if (typeof json?.signed_url === 'string') {
          setSignedUrl(json.signed_url);
        } else {
          setError('Could not load that photo.');
        }
      } catch {
        if (!cancelled) setError('Could not load that photo.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mediaId, qrToken]);

  useEffect(() => {
    if (!mediaId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = prev;
    };
  }, [mediaId, onClose]);

  if (!mediaId) return null;

  const previewSrc = signedUrl || thumbnailUrl || null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo preview"
      className="fixed inset-0 z-[1050] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        aria-label="Close photo"
        className="absolute top-4 right-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/60 active:scale-[0.98] transition-all duration-150"
      >
        <X className="h-5 w-5" />
      </button>

      {previewSrc ? (
        <img
          src={previewSrc}
          alt=""
          className="max-h-[90vh] max-w-[92vw] object-contain rounded-lg shadow-2xl"
        />
      ) : error ? (
        <div className="rounded-lg bg-white/10 px-6 py-4 text-body-sm text-white">
          {error}
        </div>
      ) : (
        <div className="h-10 w-10 rounded-full border-2 border-white/60 border-t-transparent animate-spin" />
      )}
    </div>
  );
}
