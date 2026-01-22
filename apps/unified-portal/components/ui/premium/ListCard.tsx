'use client';

import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Button } from './Button';
import { Badge, type BadgeVariant } from './Badge';

// ============================================================================
// LIST CARD - For displaying lists of items (developments, homeowners, etc.)
// ============================================================================
interface ListCardProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  items: ListItemProps[];
  onViewAll?: () => void;
  viewAllLabel?: string;
  viewAllHref?: string;
  emptyMessage?: string;
  emptyAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
  maxItems?: number;
}

export const ListCard = memo(function ListCard({
  title,
  subtitle,
  icon: Icon,
  items,
  onViewAll,
  viewAllLabel = 'View All',
  viewAllHref,
  emptyMessage = 'No items found',
  emptyAction,
  className,
  maxItems = 5,
}: ListCardProps) {
  const displayedItems = items.slice(0, maxItems);
  const hasMore = items.length > maxItems;

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-neutral-200 shadow-card overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center">
              <Icon className="w-4.5 h-4.5 text-neutral-600" />
            </div>
          )}
          <div>
            <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
            {subtitle && <p className="text-sm text-neutral-500">{subtitle}</p>}
          </div>
        </div>

        {(onViewAll || viewAllHref) && (
          viewAllHref ? (
            <a
              href={viewAllHref}
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
            >
              {viewAllLabel}
              <ChevronRight className="w-4 h-4" />
            </a>
          ) : (
            <Button variant="ghost" size="xs" rightIcon={ChevronRight} onClick={onViewAll}>
              {viewAllLabel}
            </Button>
          )
        )}
      </div>

      {/* Items */}
      {displayedItems.length > 0 ? (
        <div className="divide-y divide-neutral-100">
          {displayedItems.map((item, index) => (
            <ListItem key={item.id || index} {...item} />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center">
          <p className="text-sm text-neutral-500 mb-4">{emptyMessage}</p>
          {emptyAction && (
            emptyAction.href ? (
              <a
                href={emptyAction.href}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors"
              >
                {emptyAction.label}
              </a>
            ) : (
              <Button variant="primary" size="sm" onClick={emptyAction.onClick}>
                {emptyAction.label}
              </Button>
            )
          )}
        </div>
      )}

      {/* Footer - Show more indicator */}
      {hasMore && (
        <div className="px-6 py-3 bg-neutral-50 border-t border-neutral-100 text-center">
          <span className="text-xs text-neutral-500">
            Showing {displayedItems.length} of {items.length} items
          </span>
        </div>
      )}
    </div>
  );
});

// ============================================================================
// LIST ITEM
// ============================================================================
interface ListItemProps {
  id?: string;
  title: string;
  subtitle?: string;
  meta?: string;
  href?: string;
  onClick?: () => void;
  badge?: {
    label: string;
    variant?: BadgeVariant;
  };
  avatar?: {
    src?: string;
    initials?: string;
    color?: string;
  };
  icon?: LucideIcon;
  rightContent?: ReactNode;
  className?: string;
}

export const ListItem = memo(function ListItem({
  title,
  subtitle,
  meta,
  href,
  onClick,
  badge,
  avatar,
  icon: Icon,
  rightContent,
  className,
}: ListItemProps) {
  const Wrapper = href ? 'a' : onClick ? 'button' : 'div';
  const isInteractive = href || onClick;

  return (
    <Wrapper
      href={href as string}
      onClick={onClick}
      className={cn(
        'flex items-center justify-between px-6 py-4 w-full text-left',
        isInteractive && 'hover:bg-neutral-50 transition-colors cursor-pointer',
        className
      )}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        {/* Avatar or Icon */}
        {(avatar || Icon) && (
          <div className="flex-shrink-0">
            {avatar ? (
              avatar.src ? (
                <img
                  src={avatar.src}
                  alt={title}
                  className="w-10 h-10 rounded-lg object-cover"
                />
              ) : (
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-semibold',
                    avatar.color || 'bg-brand-100 text-brand-700'
                  )}
                >
                  {avatar.initials || title.charAt(0).toUpperCase()}
                </div>
              )
            ) : Icon ? (
              <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center">
                <Icon className="w-5 h-5 text-neutral-600" />
              </div>
            ) : null}
          </div>
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-neutral-900 truncate">{title}</h4>
            {badge && (
              <Badge variant={badge.variant || 'neutral'} size="sm">
                {badge.label}
              </Badge>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-neutral-500 truncate mt-0.5">{subtitle}</p>
          )}
          {meta && <p className="text-xs text-neutral-400 mt-1">{meta}</p>}
        </div>
      </div>

      {/* Right content */}
      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
        {rightContent}
        {isInteractive && (
          <ChevronRight className="w-4 h-4 text-neutral-400" />
        )}
      </div>
    </Wrapper>
  );
});

// ============================================================================
// COMPACT LIST
// ============================================================================
interface CompactListProps {
  items: Array<{
    id?: string;
    label: string;
    value?: string | number;
    href?: string;
    onClick?: () => void;
  }>;
  className?: string;
}

export const CompactList = memo(function CompactList({ items, className }: CompactListProps) {
  return (
    <div className={cn('space-y-1', className)}>
      {items.map((item, index) => {
        const Wrapper = item.href ? 'a' : item.onClick ? 'button' : 'div';
        const isInteractive = item.href || item.onClick;

        return (
          <Wrapper
            key={item.id || index}
            href={item.href as string}
            onClick={item.onClick}
            className={cn(
              'flex items-center justify-between p-3 rounded-lg w-full text-left',
              isInteractive
                ? 'hover:bg-neutral-100 transition-colors cursor-pointer'
                : 'bg-neutral-50'
            )}
          >
            <span className="text-sm text-neutral-700">{item.label}</span>
            {item.value !== undefined && (
              <span className="text-sm font-medium text-neutral-900">{item.value}</span>
            )}
            {isInteractive && !item.value && (
              <ChevronRight className="w-4 h-4 text-neutral-400" />
            )}
          </Wrapper>
        );
      })}
    </div>
  );
});

export default ListCard;
