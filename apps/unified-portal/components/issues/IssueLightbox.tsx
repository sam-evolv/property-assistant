'use client';

/**
 * Full screen image overlay for the developer dashboard. Same pattern
 * as components/assistant/MediaLightbox.tsx but takes a pre-signed
 * URL directly rather than fetching via x-qr-token.
 *
 * Closes on Escape, backdrop click, and the X button. Body scroll is
 * locked while open.
 */

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface IssueLightboxProps {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

export function IssueLightbox({ src, alt, onClose }: IssueLightboxProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!src) return;
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
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo preview"
      className="fixed inset-0 z-[1080] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fadeIn"
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
      <img
        src={src}
        alt={alt ?? ''}
        className="max-h-[90vh] max-w-[92vw] object-contain rounded-lg shadow-2xl"
      />
    </div>
  );
}
