import { useEffect, useRef, RefObject } from 'react';

/**
 * Detects clicks outside of a referenced element
 * @param handler - Callback when clicked outside
 * @param enabled - Whether the hook is enabled
 */
export function useClickOutside<T extends HTMLElement = HTMLElement>(
  handler: () => void,
  enabled = true
): RefObject<T> {
  const ref = useRef<T>(null);
  const handlerRef = useRef(handler);

  // Keep handler ref updated
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;

    const listener = (event: MouseEvent | TouchEvent) => {
      const el = ref.current;
      if (!el || el.contains(event.target as Node)) {
        return;
      }
      handlerRef.current();
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener, { passive: true });

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [enabled]);

  return ref;
}
