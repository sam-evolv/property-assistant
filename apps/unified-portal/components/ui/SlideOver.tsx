'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  position?: 'left' | 'right';
  showCloseButton?: boolean;
  footer?: React.ReactNode;
  className?: string;
}

const widthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export function SlideOver({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 'md',
  position = 'right',
  showCloseButton = true,
  footer,
  className,
}: SlideOverProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Focus trap
  useEffect(() => {
    if (open && panelRef.current) {
      const focusableElements = panelRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      firstElement?.focus();
    }
  }, [open]);

  if (typeof window === 'undefined') return null;

  const content = (
    <div
      className={cn(
        'fixed inset-0 z-50 transition-opacity duration-300',
        open ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          'absolute inset-y-0 w-full bg-white shadow-2xl flex flex-col',
          'transition-transform duration-300 ease-out',
          widthClasses[width],
          position === 'right' ? 'right-0' : 'left-0',
          position === 'right'
            ? open ? 'translate-x-0' : 'translate-x-full'
            : open ? 'translate-x-0' : '-translate-x-full',
          className
        )}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between p-5 border-b border-gray-200">
            <div>
              {title && (
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              )}
              {subtitle && (
                <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 -m-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-gray-200 p-5 bg-gray-50">{footer}</div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

// Detail SlideOver variant with tabs
interface DetailSlideOverProps extends Omit<SlideOverProps, 'children'> {
  tabs?: { id: string; label: string; content: React.ReactNode }[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  headerContent?: React.ReactNode;
  stats?: { label: string; value: string | number }[];
}

export function DetailSlideOver({
  tabs,
  activeTab,
  onTabChange,
  headerContent,
  stats,
  ...props
}: DetailSlideOverProps) {
  const currentTab = tabs?.find((t) => t.id === activeTab) || tabs?.[0];

  return (
    <SlideOver {...props} width="lg">
      {/* Header Content */}
      {headerContent && (
        <div className="mb-6 pb-5 border-b border-gray-200">{headerContent}</div>
      )}

      {/* Stats Row */}
      {stats && stats.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <p className="text-lg font-semibold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      {tabs && tabs.length > 0 && (
        <>
          <div className="flex gap-1 border-b border-gray-200 mb-5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange?.(tab.id)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                  activeTab === tab.id || (!activeTab && tabs[0].id === tab.id)
                    ? 'text-gold-600 border-gold-500'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div>{currentTab?.content}</div>
        </>
      )}
    </SlideOver>
  );
}

export default SlideOver;
