import { useState, useCallback, useRef, RefObject } from 'react';

interface UseHoverReturn<T extends HTMLElement> {
  ref: RefObject<T>;
  isHovered: boolean;
}

/**
 * Hover state hook with ref
 * @returns ref to attach to element and hover state
 */
export function useHover<T extends HTMLElement = HTMLElement>(): UseHoverReturn<T> {
  const [isHovered, setIsHovered] = useState(false);
  const ref = useRef<T>(null);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  // Use native event listeners for better performance
  const setRef = useCallback(
    (node: T | null) => {
      // Remove old listeners
      if (ref.current) {
        ref.current.removeEventListener('mouseenter', handleMouseEnter);
        ref.current.removeEventListener('mouseleave', handleMouseLeave);
      }

      // Add new listeners
      if (node) {
        node.addEventListener('mouseenter', handleMouseEnter);
        node.addEventListener('mouseleave', handleMouseLeave);
      }

      (ref as React.MutableRefObject<T | null>).current = node;
    },
    [handleMouseEnter, handleMouseLeave]
  );

  return {
    ref: { current: ref.current } as RefObject<T>,
    isHovered,
  };
}
