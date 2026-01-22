/**
 * Custom Hook Template
 *
 * Usage: Copy and customize for new hooks
 *
 * Checklist:
 * - [ ] Starts with "use" prefix
 * - [ ] Returns typed values
 * - [ ] Handles cleanup in useEffect
 * - [ ] Dependencies array is correct
 * - [ ] Memoized with useCallback/useMemo where needed
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface UseHookNameOptions {
  /** Initial value */
  initialValue?: string;

  /** Callback when value changes */
  onChange?: (value: string) => void;

  /** Delay in milliseconds (for debounce/throttle hooks) */
  delay?: number;
}

export interface UseHookNameReturn {
  /** Current value */
  value: string;

  /** Update the value */
  setValue: (value: string) => void;

  /** Reset to initial value */
  reset: () => void;

  /** Loading state (for async hooks) */
  isLoading: boolean;

  /** Error state (for async hooks) */
  error: Error | null;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useHookName({
  initialValue = '',
  onChange,
  delay = 0,
}: UseHookNameOptions = {}): UseHookNameReturn {
  // State
  const [value, setValueState] = useState(initialValue);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs for cleanup and tracking
  const mountedRef = useRef(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Memoized setValue with optional delay
  const setValue = useCallback(
    (newValue: string) => {
      if (delay > 0) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          if (mountedRef.current) {
            setValueState(newValue);
            onChange?.(newValue);
          }
        }, delay);
      } else {
        setValueState(newValue);
        onChange?.(newValue);
      }
    },
    [delay, onChange]
  );

  // Reset to initial value
  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setValueState(initialValue);
    setError(null);
  }, [initialValue]);

  // Return memoized object to prevent unnecessary re-renders
  return useMemo(
    () => ({
      value,
      setValue,
      reset,
      isLoading,
      error,
    }),
    [value, setValue, reset, isLoading, error]
  );
}

// ============================================================================
// Additional Hook Examples
// ============================================================================

/**
 * useDebounce - Debounce a value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * useToggle - Boolean toggle state
 */
export function useToggle(initialValue = false) {
  const [value, setValue] = useState(initialValue);

  const toggle = useCallback(() => setValue((v) => !v), []);
  const setTrue = useCallback(() => setValue(true), []);
  const setFalse = useCallback(() => setValue(false), []);

  return { value, toggle, setTrue, setFalse, setValue };
}

/**
 * useClickOutside - Detect clicks outside an element
 */
export function useClickOutside(
  ref: React.RefObject<HTMLElement>,
  handler: () => void
) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler();
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

/**
 * useKeyboardShortcut - Listen for keyboard shortcuts
 */
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: { ctrl?: boolean; meta?: boolean; shift?: boolean } = {}
) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const { ctrl, meta, shift } = options;

      if (ctrl && !event.ctrlKey) return;
      if (meta && !event.metaKey) return;
      if (shift && !event.shiftKey) return;
      if (event.key.toLowerCase() !== key.toLowerCase()) return;

      event.preventDefault();
      callback();
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [key, callback, options]);
}

/**
 * useLocalStorage - Persist state to localStorage
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.error('useLocalStorage error:', error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue] as const;
}
