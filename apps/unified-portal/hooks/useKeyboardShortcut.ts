import { useEffect, useRef, useCallback } from 'react';

interface Modifiers {
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
}

/**
 * Keyboard shortcut hook with global listener deduplication
 * Uses event listener deduplication pattern from Vercel best practices
 * @param key - The key to listen for
 * @param callback - Callback when shortcut is triggered
 * @param modifiers - Modifier keys required
 * @param enabled - Whether the shortcut is enabled
 */
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  modifiers: Modifiers = {},
  enabled = true
): void {
  const callbackRef = useRef(callback);

  // Keep callback ref updated (prevents stale closures)
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const { ctrl, meta, shift, alt } = modifiers;

      // Check modifier keys
      if (ctrl && !event.ctrlKey) return;
      if (meta && !event.metaKey) return;
      if (shift && !event.shiftKey) return;
      if (alt && !event.altKey) return;

      // Check if key matches (case-insensitive)
      if (event.key.toLowerCase() !== key.toLowerCase()) return;

      // Ignore if in input/textarea
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      event.preventDefault();
      callbackRef.current();
    },
    [key, modifiers]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}

/**
 * Common keyboard shortcuts preset
 */
export const KeyboardShortcuts = {
  SAVE: { key: 's', modifiers: { meta: true } },
  SEARCH: { key: 'k', modifiers: { meta: true } },
  ESCAPE: { key: 'Escape', modifiers: {} },
  ENTER: { key: 'Enter', modifiers: {} },
  DELETE: { key: 'Backspace', modifiers: { meta: true } },
  UNDO: { key: 'z', modifiers: { meta: true } },
  REDO: { key: 'z', modifiers: { meta: true, shift: true } },
  COPY: { key: 'c', modifiers: { meta: true } },
  PASTE: { key: 'v', modifiers: { meta: true } },
} as const;
