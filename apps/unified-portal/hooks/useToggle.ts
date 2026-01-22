import { useState, useCallback } from 'react';

interface UseToggleReturn {
  value: boolean;
  toggle: () => void;
  setTrue: () => void;
  setFalse: () => void;
  setValue: (value: boolean) => void;
}

/**
 * Toggle hook for boolean state with stable callbacks
 * @param initialValue - Initial boolean value
 */
export function useToggle(initialValue = false): UseToggleReturn {
  const [value, setValue] = useState(initialValue);

  // Stable callbacks that never change (functional setState pattern)
  const toggle = useCallback(() => setValue(v => !v), []);
  const setTrue = useCallback(() => setValue(true), []);
  const setFalse = useCallback(() => setValue(false), []);

  return {
    value,
    toggle,
    setTrue,
    setFalse,
    setValue,
  };
}
