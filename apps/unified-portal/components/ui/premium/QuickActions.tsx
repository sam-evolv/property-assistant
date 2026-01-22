'use client';

import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, type LucideIcon } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================
export interface QuickAction {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  onClick?: () => void;
  href?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning';
  shortcut?: string;
  badge?: string;
  disabled?: boolean;
}

interface QuickActionsProps {
  actions: QuickAction[];
  title?: string;
  className?: string;
  layout?: 'horizontal' | 'grid';
  columns?: 2 | 3 | 4;
}

// ============================================================================
// VARIANT STYLES
// ============================================================================
const variantStyles = {
  default: {
    bg: 'bg-neutral-50 hover:bg-neutral-100',
    icon: 'bg-neutral-100 text-neutral-600 group-hover:bg-neutral-200',
    text: 'text-neutral-700',
  },
  primary: {
    bg: 'bg-brand-50 hover:bg-brand-100',
    icon: 'bg-brand-100 text-brand-600 group-hover:bg-brand-200',
    text: 'text-brand-700',
  },
  success: {
    bg: 'bg-emerald-50 hover:bg-emerald-100',
    icon: 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-200',
    text: 'text-emerald-700',
  },
  warning: {
    bg: 'bg-amber-50 hover:bg-amber-100',
    icon: 'bg-amber-100 text-amber-600 group-hover:bg-amber-200',
    text: 'text-amber-700',
  },
};

// ============================================================================
// QUICK ACTION ITEM
// ============================================================================
const QuickActionItem = memo(function QuickActionItem({
  action,
  layout,
}: {
  action: QuickAction;
  layout: 'horizontal' | 'grid';
}) {
  const styles = variantStyles[action.variant || 'default'];
  const Icon = action.icon;

  const Wrapper = action.href ? 'a' : 'button';
  const wrapperProps = action.href
    ? { href: action.href }
    : { onClick: action.onClick, disabled: action.disabled };

  return (
    <Wrapper
      {...(wrapperProps as any)}
      className={cn(
        'group flex items-center gap-3 rounded-xl transition-all',
        styles.bg,
        layout === 'horizontal' ? 'px-4 py-3' : 'p-4',
        action.disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
          styles.icon
        )}
      >
        <Icon className="w-5 h-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-medium', styles.text)}>
            {action.label}
          </span>
          {action.badge && (
            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-brand-500 text-white rounded">
              {action.badge}
            </span>
          )}
          {action.shortcut && (
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-neutral-400 bg-neutral-200/50 rounded">
              {action.shortcut}
            </kbd>
          )}
        </div>
        {action.description && layout === 'grid' && (
          <p className="text-xs text-neutral-500 mt-0.5 truncate">
            {action.description}
          </p>
        )}
      </div>

      {/* Arrow */}
      <ChevronRight
        className={cn(
          'w-4 h-4 text-neutral-400 transition-transform group-hover:translate-x-0.5',
          layout === 'grid' && 'hidden'
        )}
      />
    </Wrapper>
  );
});

// ============================================================================
// QUICK ACTIONS BAR (Horizontal layout)
// ============================================================================
export const QuickActionsBar = memo(function QuickActionsBar({
  actions,
  title,
  className,
}: Omit<QuickActionsProps, 'layout' | 'columns'>) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-neutral-200 shadow-card p-2',
        className
      )}
    >
      {title && (
        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider px-2 mb-2">
          {title}
        </p>
      )}
      <div className="flex items-center gap-2 overflow-x-auto">
        {actions.map((action) => (
          <QuickActionItem key={action.id} action={action} layout="horizontal" />
        ))}
      </div>
    </div>
  );
});

// ============================================================================
// QUICK ACTIONS GRID
// ============================================================================
export const QuickActionsGrid = memo(function QuickActionsGrid({
  actions,
  title,
  className,
  columns = 4,
}: Omit<QuickActionsProps, 'layout'>) {
  return (
    <div className={className}>
      {title && (
        <h3 className="text-sm font-semibold text-neutral-900 mb-4">{title}</h3>
      )}
      <div
        className={cn(
          'grid gap-3',
          columns === 2 && 'grid-cols-1 sm:grid-cols-2',
          columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
          columns === 4 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
        )}
      >
        {actions.map((action) => (
          <QuickActionItem key={action.id} action={action} layout="grid" />
        ))}
      </div>
    </div>
  );
});

// ============================================================================
// QUICK ACTIONS (unified export)
// ============================================================================
export const QuickActions = memo(function QuickActions({
  actions,
  title,
  className,
  layout = 'horizontal',
  columns = 4,
}: QuickActionsProps) {
  if (layout === 'grid') {
    return (
      <QuickActionsGrid
        actions={actions}
        title={title}
        className={className}
        columns={columns}
      />
    );
  }

  return <QuickActionsBar actions={actions} title={title} className={className} />;
});

export default QuickActions;
