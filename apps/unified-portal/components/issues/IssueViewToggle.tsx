'use client';

/**
 * View toggle for /developer/issues. Spec section 2.1 + 5.
 *
 * Segmented control with two options: "By unit" (default) and "Activity".
 * Active option has a brand-colour pill fill; inactive options are neutral.
 * Sits below the page heading and above the overview cards.
 */

import { LayoutGrid, ListOrdered } from 'lucide-react';
import { IssueDashboardView } from './types';

interface IssueViewToggleProps {
  value: IssueDashboardView;
  onChange: (next: IssueDashboardView) => void;
}

interface ToggleOption {
  value: IssueDashboardView;
  label: string;
  icon: typeof LayoutGrid;
}

const OPTIONS: ToggleOption[] = [
  { value: 'unit', label: 'By unit', icon: LayoutGrid },
  { value: 'activity', label: 'Activity', icon: ListOrdered },
];

export function IssueViewToggle({ value, onChange }: IssueViewToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="Issue view"
      className="inline-flex items-center gap-1 p-1 bg-neutral-100 rounded-full"
    >
      {OPTIONS.map((opt) => {
        const isActive = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-body-sm font-medium transition-colors min-h-[36px] ${
              isActive
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-neutral-700 hover:text-neutral-900'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
