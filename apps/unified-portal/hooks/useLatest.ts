import { useRef, useEffect, MutableRefObject } from 'react';

/**
 * Returns a ref that always contains the latest value
 * Useful for accessing current values in callbacks without adding dependencies
 * Prevents stale closures in effects (Vercel best practice)
 *
 * @param value - The value to track
 */
export function useLatest<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}
