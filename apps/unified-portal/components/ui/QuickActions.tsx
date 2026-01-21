'use client';

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
}

interface QuickActionsBarProps {
  actions: QuickAction[];
  className?: string;
}

export function QuickActionsBar({ actions, className }: QuickActionsBarProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 p-2 bg-white rounded-xl border border-gray-200',
        className
      )}
    >
      {actions.map((action) => {
        const Icon = action.icon;

        return (
          <button
            key={action.id}
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(
              'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all',
              'active:scale-[0.98]',
              action.disabled && 'opacity-50 cursor-not-allowed',
              action.variant === 'primary'
                ? 'bg-gold-500 text-white hover:bg-gold-600'
                : action.variant === 'danger'
                ? 'text-red-600 hover:bg-red-50'
                : 'text-gray-700 hover:bg-gray-100'
            )}
          >
            <Icon className="w-4 h-4" />
            <span>{action.label}</span>
            {action.shortcut && (
              <kbd
                className={cn(
                  'hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded',
                  action.variant === 'primary'
                    ? 'bg-gold-600 text-gold-100'
                    : 'bg-gray-100 text-gray-500'
                )}
              >
                {action.shortcut}
              </kbd>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Floating Quick Actions (Fixed position)
interface FloatingQuickActionsProps extends QuickActionsBarProps {
  position?: 'bottom-right' | 'bottom-center' | 'top-center';
}

export function FloatingQuickActions({
  actions,
  position = 'bottom-right',
  className,
}: FloatingQuickActionsProps) {
  const positionStyles = {
    'bottom-right': 'fixed bottom-20 right-4',
    'bottom-center': 'fixed bottom-20 left-1/2 -translate-x-1/2',
    'top-center': 'fixed top-4 left-1/2 -translate-x-1/2',
  };

  return (
    <div className={cn(positionStyles[position], 'z-40', className)}>
      <QuickActionsBar actions={actions} className="shadow-lg" />
    </div>
  );
}

// Contextual Quick Actions (Inline)
interface ContextualActionsProps {
  actions: QuickAction[];
  selectedCount?: number;
  onClearSelection?: () => void;
  className?: string;
}

export function ContextualActions({
  actions,
  selectedCount,
  onClearSelection,
  className,
}: ContextualActionsProps) {
  if (!selectedCount || selectedCount === 0) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-3 bg-gold-50 border border-gold-200 rounded-xl',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gold-800">
          {selectedCount} selected
        </span>
        {onClearSelection && (
          <button
            onClick={onClearSelection}
            className="text-xs text-gold-600 hover:text-gold-800 underline"
          >
            Clear
          </button>
        )}
      </div>
      <div className="h-4 w-px bg-gold-300" />
      <div className="flex items-center gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={action.onClick}
              disabled={action.disabled}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                action.disabled && 'opacity-50 cursor-not-allowed',
                action.variant === 'danger'
                  ? 'text-red-600 bg-red-50 hover:bg-red-100'
                  : 'text-gold-800 bg-gold-100 hover:bg-gold-200'
              )}
            >
              <Icon className="w-4 h-4" />
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default QuickActionsBar;
