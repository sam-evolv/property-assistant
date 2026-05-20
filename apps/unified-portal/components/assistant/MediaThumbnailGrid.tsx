'use client';

/**
 * Thumbnail grid rendered inside a chat user message that has attachments.
 * Sprint 1 of Assistant V2, section 7.4.
 *
 * Up to 6 square thumbnails in a 3-column grid. Clicking a thumbnail opens
 * the lightbox via the onOpenLightbox callback owned by the parent.
 *
 * Layout spec is verbatim from docs/specs/assistant-v2-sprint-1.md:
 *   grid-cols-3 gap-1.5 max-w-xs, square cells with neutral-200 border.
 */

import type { ChatMediaAttachment } from './chat-media-types';

interface MediaThumbnailGridProps {
  media: ChatMediaAttachment[];
  onOpenLightbox: (mediaId: string) => void;
}

export function MediaThumbnailGrid({ media, onOpenLightbox }: MediaThumbnailGridProps) {
  if (!media || media.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-1.5 max-w-xs">
      {media.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onOpenLightbox(m.id)}
          className="aspect-square rounded-md overflow-hidden border border-neutral-200 hover:border-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-brand-500 active:scale-[0.98] transition-all duration-150"
          aria-label="Open photo"
        >
          <img
            src={m.thumbnail_url}
            alt=""
            className="w-full h-full object-cover"
          />
        </button>
      ))}
    </div>
  );
}
