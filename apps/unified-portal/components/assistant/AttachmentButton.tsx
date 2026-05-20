'use client';

/**
 * Attachment button for the homeowner chat input, Sprint 1 of Assistant
 * V2 (section 7.1 of the spec).
 *
 * Behaviour:
 *   - When the spec's feature flag is off, the button does not render at
 *     all. The parent must check this; this component does not read env
 *     vars itself.
 *   - On native Capacitor with the Camera plugin available, opens the
 *     plugin's native sheet (Camera or Photo Library). Otherwise, triggers
 *     a hidden HTML <input type="file" multiple accept="image/*">. On iOS
 *     WKWebView the file input itself presents the native sheet.
 *   - When the parent reports the picker is full (selections at the max),
 *     the button is disabled.
 *
 * The component never holds selection state itself. It always calls back
 * with new files, and the parent merges them into its own state.
 */

import { useId, useRef } from 'react';
import { Paperclip } from 'lucide-react';
import {
  ASSISTANT_MEDIA_ACCEPT,
  ASSISTANT_MEDIA_MAX_FILES,
  pickImagesViaCapacitor,
} from '@/lib/assistant/attachments';

interface AttachmentButtonProps {
  remaining: number;
  disabled?: boolean;
  onSelected: (files: File[]) => void;
}

export function AttachmentButton({ remaining, disabled, onSelected }: AttachmentButtonProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const isFull = remaining <= 0;
  const isDisabled = !!disabled || isFull;

  const openPicker = async () => {
    if (isDisabled) return;
    const limit = Math.max(1, Math.min(remaining, ASSISTANT_MEDIA_MAX_FILES));
    const capacitorFiles = await pickImagesViaCapacitor(limit);
    if (capacitorFiles && capacitorFiles.length > 0) {
      onSelected(capacitorFiles);
      return;
    }
    // capacitorFiles can be null (plugin unavailable) or an empty array
    // (user cancelled). Only fall through to the HTML picker when the
    // plugin is unavailable; an empty result from a real native sheet
    // means the user cancelled, so we leave the input alone.
    if (capacitorFiles === null) {
      inputRef.current?.click();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (list && list.length > 0) {
      onSelected(Array.from(list));
    }
    // Reset so picking the same file twice still fires the change event.
    e.target.value = '';
  };

  return (
    <>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ASSISTANT_MEDIA_ACCEPT}
        multiple
        className="sr-only"
        onChange={handleChange}
        aria-hidden="true"
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={openPicker}
        disabled={isDisabled}
        aria-label="Attach photo"
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-500 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all duration-150"
      >
        <Paperclip className="w-4 h-4" />
      </button>
    </>
  );
}
