import { useState, useCallback } from 'react';

interface UseDisclosureReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setIsOpen: (value: boolean) => void;
}

/**
 * Disclosure hook for managing open/close state
 * Perfect for modals, dropdowns, tooltips, etc.
 *
 * @param defaultIsOpen - Initial open state
 */
export function useDisclosure(defaultIsOpen = false): UseDisclosureReturn {
  const [isOpen, setIsOpen] = useState(defaultIsOpen);

  // Stable callbacks using functional setState
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  return {
    isOpen,
    open,
    close,
    toggle,
    setIsOpen,
  };
}
