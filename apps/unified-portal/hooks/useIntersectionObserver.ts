import { useState, useEffect, useRef, RefObject } from 'react';

interface UseIntersectionObserverOptions {
  threshold?: number | number[];
  root?: Element | null;
  rootMargin?: string;
  freezeOnceVisible?: boolean;
}

interface UseIntersectionObserverReturn {
  ref: RefObject<HTMLElement>;
  isIntersecting: boolean;
  entry: IntersectionObserverEntry | null;
}

/**
 * Intersection Observer hook for lazy loading and scroll-triggered effects
 * @param options - IntersectionObserver options
 */
export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {}
): UseIntersectionObserverReturn {
  const {
    threshold = 0,
    root = null,
    rootMargin = '0px',
    freezeOnceVisible = false,
  } = options;

  const ref = useRef<HTMLElement>(null);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const frozen = useRef(false);

  const isIntersecting = entry?.isIntersecting ?? false;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Don't observe if frozen
    if (frozen.current && freezeOnceVisible) return;

    const observer = new IntersectionObserver(
      ([observerEntry]) => {
        setEntry(observerEntry);

        // Freeze if visible and freezeOnceVisible is true
        if (observerEntry.isIntersecting && freezeOnceVisible) {
          frozen.current = true;
          observer.unobserve(element);
        }
      },
      { threshold, root, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [threshold, root, rootMargin, freezeOnceVisible]);

  return { ref, isIntersecting, entry };
}

/**
 * Simplified hook for lazy loading components
 */
export function useLazyLoad(): {
  ref: RefObject<HTMLElement>;
  isVisible: boolean;
} {
  const { ref, isIntersecting } = useIntersectionObserver({
    threshold: 0.1,
    freezeOnceVisible: true,
  });

  return { ref, isVisible: isIntersecting };
}
