'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { HelpCircle, ExternalLink, Info } from 'lucide-react';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface HelpTooltipProps {
  content: React.ReactNode;
  title?: string;
  link?: string;
  linkText?: string;
  position?: TooltipPosition;
  variant?: 'default' | 'info' | 'warning';
  maxWidth?: number;
  delay?: number;
  className?: string;
  iconClassName?: string;
  children?: React.ReactNode;
}

export function HelpTooltip({
  content,
  title,
  link,
  linkText = 'Learn more',
  position = 'top',
  variant = 'default',
  maxWidth = 280,
  delay = 200,
  className,
  iconClassName,
  children,
}: HelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate position to keep tooltip in viewport
  useEffect(() => {
    if (!isVisible || !tooltipRef.current || !triggerRef.current) return;

    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let newPosition = position;

    // Check if tooltip overflows viewport and adjust
    if (position === 'top' && tooltipRect.top < 0) {
      newPosition = 'bottom';
    } else if (position === 'bottom' && tooltipRect.bottom > viewportHeight) {
      newPosition = 'top';
    } else if (position === 'left' && tooltipRect.left < 0) {
      newPosition = 'right';
    } else if (position === 'right' && tooltipRect.right > viewportWidth) {
      newPosition = 'left';
    }

    if (newPosition !== actualPosition) {
      setActualPosition(newPosition);
    }
  }, [isVisible, position, actualPosition]);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const positionStyles: Record<TooltipPosition, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowStyles: Record<TooltipPosition, string> = {
    top: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-t-gray-900 border-x-transparent border-b-transparent',
    bottom: 'top-0 left-1/2 -translate-x-1/2 -translate-y-full border-b-gray-900 border-x-transparent border-t-transparent',
    left: 'right-0 top-1/2 -translate-y-1/2 translate-x-full border-l-gray-900 border-y-transparent border-r-transparent',
    right: 'left-0 top-1/2 -translate-y-1/2 -translate-x-full border-r-gray-900 border-y-transparent border-l-transparent',
  };

  const variantStyles = {
    default: '',
    info: 'border-blue-500/20',
    warning: 'border-amber-500/20',
  };

  return (
    <div
      ref={triggerRef}
      className={cn('relative inline-flex items-center', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {/* Trigger */}
      {children || (
        <button
          type="button"
          className={cn(
            'p-0.5 rounded-full text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gold-500/20',
            iconClassName
          )}
          aria-label="Help"
        >
          {variant === 'info' ? (
            <Info className="w-4 h-4" />
          ) : (
            <HelpCircle className="w-4 h-4" />
          )}
        </button>
      )}

      {/* Tooltip */}
      {isVisible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={cn(
            'absolute z-50 animate-in fade-in zoom-in-95 duration-150',
            positionStyles[actualPosition]
          )}
          style={{ maxWidth }}
        >
          <div
            className={cn(
              'bg-gray-900 text-white rounded-lg shadow-xl border border-gray-800 overflow-hidden',
              variantStyles[variant]
            )}
          >
            {/* Title */}
            {title && (
              <div className="px-3 py-2 border-b border-gray-800">
                <p className="text-xs font-semibold text-white">{title}</p>
              </div>
            )}

            {/* Content */}
            <div className="px-3 py-2">
              <p className="text-xs text-gray-300 leading-relaxed">{content}</p>
            </div>

            {/* Link */}
            {link && (
              <div className="px-3 py-2 border-t border-gray-800 bg-gray-800/50">
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-gold-400 hover:text-gold-300 transition-colors"
                >
                  {linkText}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {/* Arrow */}
          <div
            className={cn(
              'absolute w-0 h-0 border-4',
              arrowStyles[actualPosition]
            )}
          />
        </div>
      )}
    </div>
  );
}

// Simple inline tooltip for quick hints
interface SimpleTooltipProps {
  content: string;
  position?: TooltipPosition;
  children: React.ReactNode;
  className?: string;
}

export function SimpleTooltip({
  content,
  position = 'top',
  children,
  className,
}: SimpleTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positionStyles: Record<TooltipPosition, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  };

  return (
    <div
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          role="tooltip"
          className={cn(
            'absolute z-50 px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md whitespace-nowrap',
            'animate-in fade-in zoom-in-95 duration-100',
            positionStyles[position]
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}

export default HelpTooltip;
