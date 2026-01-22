import { useRef, useEffect } from 'react';

/**
 * Returns the previous value of a variable
 * Useful for comparing current vs previous state
 *
 * @param value - The value to track
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}
