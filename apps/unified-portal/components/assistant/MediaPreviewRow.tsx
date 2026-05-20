'use client';

/**
 * Selected media preview row, shown above the chat input bar while files
 * are staged but not yet sent. Sprint 1 of Assistant V2, section 7.2.
 *
 * Visual spec is verbatim from docs/specs/assistant-v2-sprint-1.md:
 *   - 64x64 rounded thumbnails, neutral-200 border
 *   - X button overlay at the top right corner
 *   - flex-wrap so multiple thumbnails reflow on narrow screens
 *
 * The component is presentational. The parent owns the selection state.
 */

import { X } from 'lucide-react';
import type { SelectedAttachment } from '@/lib/assistant/attachments';

interface MediaPreviewRowProps {
  selections: SelectedAttachment[];
  onRemove: (id: string) => void;
  disabled?: boolean;
}

export function MediaPreviewRow({ selections, onRemove, disabled }: MediaPreviewRowProps) {
  if (selections.length === 0) return null;

  return (
    <div
      className="flex gap-2 flex-wrap px-4 pb-2"
      aria-label="Selected photos"
    >
      {selections.map((sel) => (
        <div key={sel.id} className="relative group">
          <img
            src={sel.previewUrl}
            alt=""
            className="w-16 h-16 rounded-lg object-cover border border-neutral-200"
          />
          <button
            type="button"
            onClick={() => onRemove(sel.id)}
            disabled={disabled}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center hover:bg-neutral-800 disabled:opacity-50 disabled:pointer-events-none transition-all duration-150"
            aria-label="Remove attachment"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
