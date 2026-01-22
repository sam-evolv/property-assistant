import { useEffect, useRef, RefObject } from 'react';

const FOCUSABLE_ELEMENTS = [
  'a[href]',
  'area[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]',
].join(',');

/**
 * Traps focus within a container - essential for modal accessibility
 * @param active - Whether the focus trap is active
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  active = true
): RefObject<T> {
  const containerRef = useRef<T>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    // Store currently focused element
    previouslyFocusedElement.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element
    if (firstElement) {
      firstElement.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      // Get current focusable elements (may change during trap)
      const currentFocusableElements = container.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS);
      const first = currentFocusableElements[0];
      const last = currentFocusableElements[currentFocusableElements.length - 1];

      if (!first || !last) return;

      // Shift + Tab
      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      }
      // Tab
      else {
        if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      // Restore focus to previously focused element
      if (previouslyFocusedElement.current) {
        previouslyFocusedElement.current.focus();
      }
    };
  }, [active]);

  return containerRef;
}
