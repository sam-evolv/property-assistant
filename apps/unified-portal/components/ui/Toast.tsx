'use client';

import { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { cn } from '@/lib/utils';
import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  Undo2,
} from 'lucide-react';

// Legacy support - re-export Toaster for existing code
import { Toaster } from 'react-hot-toast';

export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#ffffff',
          color: '#1a1a1a',
          border: '1px solid #e5e5e5',
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        },
        success: {
          duration: 3000,
          iconTheme: {
            primary: '#10b981',
            secondary: '#fff',
          },
        },
        error: {
          duration: 5000,
          iconTheme: {
            primary: '#ef4444',
            secondary: '#fff',
          },
        },
      }}
    />
  );
}

// Enhanced Toast System
export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  message: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  undoAction?: () => void;
  undoLabel?: string;
}

interface ToastItemProps extends ToastData {
  onClose: (id: string) => void;
}

const variantConfig = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    iconColor: 'text-green-500',
    progressColor: 'bg-green-500',
  },
  error: {
    icon: AlertCircle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-500',
    progressColor: 'bg-red-500',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    iconColor: 'text-amber-500',
    progressColor: 'bg-amber-500',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-500',
    progressColor: 'bg-blue-500',
  },
};

function ToastItem({
  id,
  message,
  description,
  variant = 'info',
  duration = 4000,
  undoAction,
  undoLabel = 'Undo',
  onClose,
}: ToastItemProps) {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);

  const config = variantConfig[variant];
  const Icon = config.icon;

  // Duration is longer when there's an undo action
  const actualDuration = undoAction ? 6000 : duration;

  useEffect(() => {
    if (isPaused) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / actualDuration) * 100);
      setProgress(remaining);

      if (remaining === 0) {
        clearInterval(interval);
        onClose(id);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [id, actualDuration, onClose, isPaused]);

  const handleUndo = useCallback(() => {
    undoAction?.();
    onClose(id);
  }, [undoAction, onClose, id]);

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 p-4 rounded-xl border shadow-lg',
        'animate-in slide-in-from-right-full fade-in duration-300',
        'min-w-[320px] max-w-[420px]',
        config.bgColor,
        config.borderColor
      )}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', config.iconColor)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{message}</p>
        {description && (
          <p className="text-xs text-gray-600 mt-1">{description}</p>
        )}
        {undoAction && (
          <button
            onClick={handleUndo}
            className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-gray-900 mt-2"
          >
            <Undo2 className="w-3 h-3" />
            {undoLabel}
          </button>
        )}
      </div>
      <button
        onClick={() => onClose(id)}
        className="p-1 rounded-lg hover:bg-black/5 transition-colors"
      >
        <X className="w-4 h-4 text-gray-400" />
      </button>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5 rounded-b-xl overflow-hidden">
        <div
          className={cn('h-full transition-all duration-50', config.progressColor)}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// Toast Container and API
let toastId = 0;
const listeners: Set<(toast: ToastData) => void> = new Set();
const dismissListeners: Set<(id: string) => void> = new Set();

export const toast = {
  show: (options: Omit<ToastData, 'id'>) => {
    const id = `toast-${++toastId}`;
    listeners.forEach((listener) => listener({ ...options, id }));
    return id;
  },
  success: (message: string, options?: Partial<Omit<ToastData, 'id' | 'message' | 'variant'>>) => {
    return toast.show({ message, variant: 'success', ...options });
  },
  error: (message: string, options?: Partial<Omit<ToastData, 'id' | 'message' | 'variant'>>) => {
    return toast.show({ message, variant: 'error', ...options });
  },
  warning: (message: string, options?: Partial<Omit<ToastData, 'id' | 'message' | 'variant'>>) => {
    return toast.show({ message, variant: 'warning', ...options });
  },
  info: (message: string, options?: Partial<Omit<ToastData, 'id' | 'message' | 'variant'>>) => {
    return toast.show({ message, variant: 'info', ...options });
  },
  dismiss: (id: string) => {
    dismissListeners.forEach((listener) => listener(id));
  },
};

export function EnhancedToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    const addToast = (newToast: ToastData) => {
      setToasts((prev) => [...prev, newToast]);
    };

    const removeToast = (id: string) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    listeners.add(addToast);
    dismissListeners.add(removeToast);

    return () => {
      listeners.delete(addToast);
      dismissListeners.delete(removeToast);
    };
  }, []);

  const handleClose = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} onClose={handleClose} />
      ))}
    </div>
  );
}

export default toast;
