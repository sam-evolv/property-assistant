import { useState, useCallback, useRef, useEffect } from 'react';

interface UseCopyToClipboardReturn {
  copy: (text: string) => Promise<boolean>;
  copied: boolean;
  error: Error | null;
  reset: () => void;
}

/**
 * Copy to clipboard hook with success/error state
 * @param resetDelay - Time in ms before copied state resets (default 2000)
 */
export function useCopyToClipboard(resetDelay = 2000): UseCopyToClipboardReturn {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const reset = useCallback(() => {
    setCopied(false);
    setError(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      try {
        // Modern Clipboard API
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
        } else {
          // Fallback for older browsers
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.style.position = 'fixed';
          textarea.style.left = '-9999px';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }

        setCopied(true);
        setError(null);

        // Auto-reset after delay
        timeoutRef.current = setTimeout(() => {
          setCopied(false);
        }, resetDelay);

        return true;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to copy'));
        setCopied(false);
        return false;
      }
    },
    [resetDelay]
  );

  return { copy, copied, error, reset };
}
