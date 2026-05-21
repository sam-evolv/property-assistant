'use client';

/**
 * Full-screen sheet for picking a room. Spec section 7.4.
 *
 * Room list is verbatim from the spec: Kitchen, Bathroom, Living Room,
 * Bedroom 1, Bedroom 2, Bedroom 3, Hall, Landing, Utility, Other.
 * Selecting Other reveals a text input below the list.
 */

import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';

const ROOMS = [
  'Kitchen',
  'Bathroom',
  'Living Room',
  'Bedroom 1',
  'Bedroom 2',
  'Bedroom 3',
  'Hall',
  'Landing',
  'Utility',
  'Other',
] as const;

interface RoomPickerSheetProps {
  open: boolean;
  selected: string;
  onClose: () => void;
  onSelect: (room: string) => void;
}

export function RoomPickerSheet({ open, selected, onClose, onSelect }: RoomPickerSheetProps) {
  const isCustom = !!selected && !ROOMS.includes(selected as (typeof ROOMS)[number]);
  const [pendingChoice, setPendingChoice] = useState<string>(() =>
    isCustom ? 'Other' : selected || '',
  );
  const [customValue, setCustomValue] = useState<string>(() => (isCustom ? selected : ''));
  const customInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const initialCustom = !!selected && !ROOMS.includes(selected as (typeof ROOMS)[number]);
      setPendingChoice(initialCustom ? 'Other' : selected || '');
      setCustomValue(initialCustom ? selected : '');
    }
  }, [open, selected]);

  useEffect(() => {
    if (pendingChoice === 'Other') {
      const t = setTimeout(() => customInputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [pendingChoice]);

  if (!open) return null;

  const canConfirm =
    pendingChoice && (pendingChoice !== 'Other' || customValue.trim().length > 0);

  const confirm = () => {
    if (!pendingChoice) return;
    if (pendingChoice === 'Other') {
      const trimmed = customValue.trim();
      if (!trimmed) return;
      onSelect(trimmed);
    } else {
      onSelect(pendingChoice);
    }
  };

  return (
    <div className="fixed inset-0 z-modal bg-white flex flex-col">
      <header className="px-4 py-3 border-b border-neutral-200 flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close room picker"
          className="w-11 h-11 -ml-2 flex items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-heading-sm text-neutral-900">Select room</h2>
      </header>

      <div className="flex-1 overflow-y-auto">
        <ul className="divide-y divide-neutral-100">
          {ROOMS.map((room) => {
            const isSelected = pendingChoice === room;
            return (
              <li key={room}>
                <button
                  type="button"
                  onClick={() => setPendingChoice(room)}
                  className={`w-full px-4 py-4 text-left flex items-center gap-3 min-h-[56px] active:bg-neutral-50 ${
                    isSelected ? 'bg-brand-50' : ''
                  }`}
                >
                  <span className="flex-1 text-body text-neutral-900">{room}</span>
                  {isSelected ? <Check className="w-5 h-5 text-brand-600" /> : null}
                </button>
              </li>
            );
          })}
        </ul>

        {pendingChoice === 'Other' ? (
          <div className="px-4 py-4 border-t border-neutral-100">
            <label className="text-caption text-neutral-500 block mb-1" htmlFor="room-other">
              Describe the room
            </label>
            <input
              ref={customInputRef}
              id="room-other"
              type="text"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              maxLength={60}
              placeholder="Garage, garden, attic"
              className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-lg text-body focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 px-4 py-3 bg-white border-t border-neutral-200">
        <button
          type="button"
          onClick={confirm}
          disabled={!canConfirm}
          className="w-full py-3 bg-brand-500 text-white rounded-lg font-medium disabled:bg-neutral-200 disabled:text-neutral-400 active:bg-brand-600 min-h-[44px]"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
