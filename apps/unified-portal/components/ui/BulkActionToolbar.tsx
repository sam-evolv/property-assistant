'use client';

import { cn } from '@/lib/utils';
import { X, Mail, Trash2, Download, Tag, Archive } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface BulkAction {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

interface BulkActionToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  actions: BulkAction[];
  className?: string;
}

export function BulkActionToolbar({
  selectedCount,
  onClearSelection,
  actions,
  className,
}: BulkActionToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-4 px-5 py-3',
        'bg-gray-900 text-white rounded-xl shadow-2xl',
        'animate-in slide-in-from-bottom-4 fade-in duration-200',
        className
      )}
    >
      {/* Selection count */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">
          <span className="text-gold-400 font-bold">{selectedCount}</span>
          {' '}selected
        </span>
        <button
          onClick={onClearSelection}
          className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
          title="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-white/20" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={action.onClick}
              disabled={action.disabled}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                'active:scale-95',
                action.disabled && 'opacity-50 cursor-not-allowed',
                action.variant === 'danger'
                  ? 'text-red-300 hover:bg-red-500/20 hover:text-red-200'
                  : 'text-white hover:bg-white/10'
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Pre-configured common bulk actions
export function getCommonBulkActions({
  onEmail,
  onExport,
  onArchive,
  onDelete,
  onTag,
}: {
  onEmail?: () => void;
  onExport?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onTag?: () => void;
}): BulkAction[] {
  const actions: BulkAction[] = [];

  if (onEmail) {
    actions.push({
      id: 'email',
      label: 'Email',
      icon: Mail,
      onClick: onEmail,
    });
  }

  if (onExport) {
    actions.push({
      id: 'export',
      label: 'Export',
      icon: Download,
      onClick: onExport,
    });
  }

  if (onTag) {
    actions.push({
      id: 'tag',
      label: 'Tag',
      icon: Tag,
      onClick: onTag,
    });
  }

  if (onArchive) {
    actions.push({
      id: 'archive',
      label: 'Archive',
      icon: Archive,
      onClick: onArchive,
    });
  }

  if (onDelete) {
    actions.push({
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      onClick: onDelete,
      variant: 'danger',
    });
  }

  return actions;
}

export default BulkActionToolbar;
