'use client';

/**
 * Full-screen sheet for switching the active development. Only rendered
 * by the parent when the user has access to more than one development.
 */

import { Check, X } from 'lucide-react';

export interface SnagDevelopment {
  id: string;
  name: string;
}

interface DevelopmentSwitcherSheetProps {
  open: boolean;
  developments: SnagDevelopment[];
  selectedId: string | null;
  onClose: () => void;
  onSelect: (dev: SnagDevelopment) => void;
}

export function DevelopmentSwitcherSheet({
  open,
  developments,
  selectedId,
  onClose,
  onSelect,
}: DevelopmentSwitcherSheetProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-modal bg-white flex flex-col">
      <header className="px-4 py-3 border-b border-neutral-200 flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close development picker"
          className="w-11 h-11 -ml-2 flex items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-heading-sm text-neutral-900">Switch development</h2>
      </header>
      <div className="flex-1 overflow-y-auto">
        <ul className="divide-y divide-neutral-100">
          {developments.map((dev) => {
            const isSelected = dev.id === selectedId;
            return (
              <li key={dev.id}>
                <button
                  type="button"
                  onClick={() => onSelect(dev)}
                  className={`w-full px-4 py-4 text-left flex items-center gap-3 min-h-[56px] active:bg-neutral-50 ${
                    isSelected ? 'bg-brand-50' : ''
                  }`}
                >
                  <span className="flex-1 text-body text-neutral-900">{dev.name}</span>
                  {isSelected ? <Check className="w-5 h-5 text-brand-600" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
