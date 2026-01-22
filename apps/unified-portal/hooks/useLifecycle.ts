import { useEffect, useRef } from 'react';

/**
 * Runs callback only on component mount
 * @param callback - Function to run on mount
 */
export function useOnMount(callback: () => void | (() => void)): void {
  const callbackRef = useRef(callback);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return callbackRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Runs callback only on component unmount
 * @param callback - Function to run on unmount
 */
export function useOnUnmount(callback: () => void): void {
  const callbackRef = useRef(callback);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => callbackRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
