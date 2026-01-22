import { useCallback, useRef, useEffect } from 'react';

/**
 * Returns a stable callback reference that always calls the latest function
 * Similar to React's upcoming useEffectEvent
 * Prevents effect re-runs and ensures fresh values
 *
 * @param callback - The callback function
 */
export function useEventCallback<T extends (...args: Parameters<T>) => ReturnType<T>>(
  callback: T
): (...args: Parameters<T>) => ReturnType<T> {
  const callbackRef = useRef(callback);

  // Keep ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Return stable callback
  return useCallback(
    (...args: Parameters<T>) => callbackRef.current(...args),
    []
  );
}
