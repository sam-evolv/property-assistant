'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  delayDuration?: number;
  className?: string;
}

export function Tooltip({
  children,
  content,
  side = 'top',
  align = 'center',
  delayDuration = 300,
  className,
}: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            align={align}
            sideOffset={4}
            className={cn(
              'z-50 px-3 py-2 text-sm bg-gray-900 text-white rounded-lg shadow-lg',
              'max-w-xs animate-in fade-in zoom-in-95 duration-150',
              className
            )}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-gray-900" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

// Contextual Help Tooltip (small ? icon with explanation)
interface HelpTooltipProps {
  content: React.ReactNode;
  learnMoreLink?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

export function HelpTooltip({
  content,
  learnMoreLink,
  side = 'top',
  className,
}: HelpTooltipProps) {
  return (
    <Tooltip
      content={
        <div className="space-y-2">
          <p>{content}</p>
          {learnMoreLink && (
            <a
              href={learnMoreLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gold-300 hover:text-gold-200 text-xs inline-flex items-center gap-1"
            >
              Learn more
            </a>
          )}
        </div>
      }
      side={side}
    >
      <button
        type="button"
        className={cn(
          'inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors',
          className
        )}
      >
        <HelpCircle className="w-4 h-4" />
      </button>
    </Tooltip>
  );
}

// Info Label with Tooltip
interface LabelWithTooltipProps {
  label: string;
  tooltip: string;
  htmlFor?: string;
  required?: boolean;
  className?: string;
}

export function LabelWithTooltip({
  label,
  tooltip,
  htmlFor,
  required,
  className,
}: LabelWithTooltipProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-gray-700"
      >
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <HelpTooltip content={tooltip} />
    </div>
  );
}

export default Tooltip;
