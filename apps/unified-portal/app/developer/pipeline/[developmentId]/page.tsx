'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, X, Plus, Check } from 'lucide-react';

// =============================================================================
// Design Tokens (from spec)
// =============================================================================

const tokens = {
  // Backgrounds
  bgPrimary: '#FFFFFF',
  bgSecondary: '#F8FAFC',
  bgTertiary: '#F1F5F9',

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',

  // Borders
  borderSubtle: '#E2E8F0',
  borderEmphasis: '#CBD5E1',

  // Status
  statusComplete: '#ECFDF5',
  statusCompleteText: '#047857',

  // Alerts
  alertBadge: '#EF4444',

  // Accent
  accentPrimary: '#0EA5E9',
};

// =============================================================================
// Types
// =============================================================================

interface PipelineUnit {
  id: string;
  pipelineId: string | null;
  unitNumber: string;
  address: string;
  purchaserName: string | null;
  releaseDate: string | null;
  saleAgreedDate: string | null;
  depositDate: string | null;
  contractsIssuedDate: string | null;
  signedContractsDate: string | null;
  counterSignedDate: string | null;
  kitchenDate: string | null;
  snagDate: string | null;
  drawdownDate: string | null;
  handoverDate: string | null;
  notesCount: number;
  unresolvedNotesCount: number;
}

interface Development {
  id: string;
  name: string;
}

interface PipelineNote {
  id: string;
  content: string;
  resolved: boolean;
  createdAt: string;
  createdBy: string;
}

// =============================================================================
// Date Formatting
// =============================================================================

function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleDateString('en-GB', { month: 'short' });
  return `${day} ${month}`;
}

// =============================================================================
// Inline Date Picker Component
// =============================================================================

interface DatePickerProps {
  value: string | null;
  onChange: (date: string) => void;
  onClose: () => void;
}

function InlineDatePicker({ value, onChange, onClose }: DatePickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    return value ? new Date(value) : new Date();
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = currentMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  // Current date value
  const selectedDate = value ? new Date(value) : null;
  const selectedDay = selectedDate?.getDate();
  const selectedMonth = selectedDate?.getMonth();
  const selectedYear = selectedDate?.getFullYear();

  const days: (number | null)[] = [];
  const startDay = firstDay === 0 ? 6 : firstDay - 1;
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const handleSelect = (day: number) => {
    const selected = new Date(year, month, day, 12, 0, 0);
    onChange(selected.toISOString());
    onClose();
  };

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const isSelected = (day: number) => {
    return day === selectedDay && month === selectedMonth && year === selectedYear;
  };

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 bg-white rounded-md z-50 p-2"
      style={{
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        border: `1px solid ${tokens.borderSubtle}`,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <button
          onClick={prevMonth}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500"
        >
          ‹
        </button>
        <span className="text-xs font-medium" style={{ color: tokens.textPrimary }}>{monthName}</span>
        <button
          onClick={nextMonth}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div
            key={i}
            className="w-7 h-5 flex items-center justify-center text-[10px]"
            style={{ color: tokens.textTertiary }}
          >
            {d}
          </div>
        ))}
        {days.map((day, i) => (
          <div key={i} className="flex items-center justify-center">
            {day && (
              <button
                onClick={() => handleSelect(day)}
                className="w-7 h-7 rounded text-xs flex items-center justify-center transition-colors"
                style={{
                  backgroundColor: isSelected(day) ? tokens.accentPrimary : 'transparent',
                  color: isSelected(day) ? '#FFFFFF' : tokens.textPrimary,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected(day)) e.currentTarget.style.backgroundColor = tokens.bgTertiary;
                }}
                onMouseLeave={(e) => {
                  if (!isSelected(day)) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {day}
              </button>
            )}
          </div>
        ))}
      </div>
      {/* Today button */}
      <button
        onClick={() => handleSelect(new Date().getDate())}
        className="w-full mt-2 py-1 text-xs rounded transition-colors"
        style={{
          backgroundColor: tokens.bgSecondary,
          color: tokens.textSecondary,
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.bgTertiary}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = tokens.bgSecondary}
      >
        Today
      </button>
    </div>
  );
}

// =============================================================================
// Editable Date Cell
// =============================================================================

interface DateCellProps {
  value: string | null;
  unitId: string;
  field: string;
  onUpdate: (unitId: string, field: string, value: string) => void;
}

function DateCell({ value, unitId, field, onUpdate }: DateCellProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const cellRef = useRef<HTMLTableCellElement>(null);

  const handleClick = () => {
    if (!value) {
      // Empty cell: set today's date immediately
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      onUpdate(unitId, field, today.toISOString());
      // Flash effect
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 300);
    } else {
      setShowPicker(true);
    }
  };

  const handleChange = (newDate: string) => {
    onUpdate(unitId, field, newDate);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 300);
  };

  const isEmpty = !value;
  const displayValue = formatDate(value);

  return (
    <td
      ref={cellRef}
      onClick={handleClick}
      className="relative cursor-pointer select-none transition-all duration-150"
      style={{
        height: '36px',
        padding: '0 12px',
        borderRight: `1px solid ${tokens.borderSubtle}`,
        borderBottom: `1px solid ${tokens.borderSubtle}`,
        backgroundColor: justSaved
          ? tokens.statusComplete
          : isEmpty
            ? 'transparent'
            : tokens.statusComplete,
        minWidth: '72px',
        fontSize: '11px',
        fontFamily: "'DM Sans', sans-serif",
      }}
      onMouseEnter={(e) => {
        if (!justSaved) e.currentTarget.style.backgroundColor = tokens.bgTertiary;
      }}
      onMouseLeave={(e) => {
        if (!justSaved) {
          e.currentTarget.style.backgroundColor = isEmpty ? 'transparent' : tokens.statusComplete;
        }
      }}
    >
      <span style={{ color: isEmpty ? tokens.textTertiary : tokens.statusCompleteText }}>
        {displayValue}
      </span>
      {showPicker && (
        <InlineDatePicker
          value={value}
          onChange={handleChange}
          onClose={() => setShowPicker(false)}
        />
      )}
    </td>
  );
}

// =============================================================================
// Editable Name Cell
// =============================================================================

interface NameCellProps {
  value: string | null;
  unitId: string;
  onUpdate: (unitId: string, field: string, value: string) => void;
}

function NameCell({ value, unitId, onUpdate }: NameCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [justSaved, setJustSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    setEditValue(value || '');
    setIsEditing(true);
  };

  const handleSave = () => {
    if (editValue !== value) {
      onUpdate(unitId, 'purchaserName', editValue);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 300);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const isEmpty = !value;

  if (isEditing) {
    return (
      <td
        style={{
          height: '36px',
          padding: '0 12px',
          borderRight: `1px solid ${tokens.borderSubtle}`,
          borderBottom: `1px solid ${tokens.borderSubtle}`,
          minWidth: '160px',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-full h-full bg-transparent outline-none"
          style={{
            fontSize: '11px',
            color: tokens.textPrimary,
            fontFamily: "'DM Sans', sans-serif",
          }}
        />
      </td>
    );
  }

  return (
    <td
      onClick={handleClick}
      className="cursor-pointer transition-colors duration-150"
      style={{
        height: '36px',
        padding: '0 12px',
        borderRight: `1px solid ${tokens.borderSubtle}`,
        borderBottom: `1px solid ${tokens.borderSubtle}`,
        backgroundColor: justSaved ? tokens.statusComplete : 'transparent',
        minWidth: '160px',
        fontSize: '11px',
        fontFamily: "'DM Sans', sans-serif",
      }}
      onMouseEnter={(e) => {
        if (!justSaved) e.currentTarget.style.backgroundColor = tokens.bgTertiary;
      }}
      onMouseLeave={(e) => {
        if (!justSaved) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <span style={{ color: isEmpty ? tokens.textTertiary : tokens.textPrimary }}>
        {value || '—'}
      </span>
    </td>
  );
}

// =============================================================================
// Queries Cell
// =============================================================================

interface QueriesCellProps {
  count: number;
  unresolvedCount: number;
  onClick: () => void;
}

function QueriesCell({ count, unresolvedCount, onClick }: QueriesCellProps) {
  const hasUnresolved = unresolvedCount > 0;

  return (
    <td
      onClick={onClick}
      className="cursor-pointer text-center transition-colors duration-150"
      style={{
        height: '36px',
        padding: '0 8px',
        borderRight: `1px solid ${tokens.borderSubtle}`,
        borderBottom: `1px solid ${tokens.borderSubtle}`,
        minWidth: '50px',
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.bgTertiary}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      {count > 0 ? (
        <span
          className="inline-flex items-center justify-center rounded-full"
          style={{
            minWidth: '20px',
            height: '20px',
            padding: '0 6px',
            backgroundColor: hasUnresolved ? tokens.alertBadge : tokens.bgTertiary,
            color: hasUnresolved ? '#FFFFFF' : tokens.textTertiary,
            fontSize: '11px',
            fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {unresolvedCount > 0 ? unresolvedCount : count}
        </span>
      ) : (
        <span style={{ color: tokens.textTertiary, fontSize: '11px', fontFamily: "'DM Sans', sans-serif" }}>
          —
        </span>
      )}
    </td>
  );
}

// =============================================================================
// Queries Slide-Out Panel
// =============================================================================

interface QueriesPanelProps {
  unit: PipelineUnit | null;
  developmentId: string;
  onClose: () => void;
  onNotesChange: () => void;
}

function QueriesPanel({ unit, developmentId, onClose, onNotesChange }: QueriesPanelProps) {
  const [notes, setNotes] = useState<PipelineNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (!unit) {
      setNotes([]);
      setIsLoading(false);
      return;
    }

    const fetchNotes = async () => {
      try {
        const response = await fetch(`/api/pipeline/${developmentId}/${unit.id}/notes`);
        if (response.ok) {
          const data = await response.json();
          setNotes(data.notes || []);
        }
      } catch (err) {
        console.error('Failed to fetch notes:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotes();
  }, [unit, developmentId]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !unit) return;

    setIsAdding(true);
    try {
      const response = await fetch(`/api/pipeline/${developmentId}/${unit.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNote.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setNotes(prev => [data.note, ...prev]);
        setNewNote('');
        onNotesChange();
      }
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleResolved = async (noteId: string, currentResolved: boolean) => {
    try {
      const response = await fetch(`/api/pipeline/${developmentId}/${unit?.id}/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: !currentResolved }),
      });

      if (response.ok) {
        setNotes(prev => prev.map(n =>
          n.id === noteId ? { ...n, resolved: !currentResolved } : n
        ));
        onNotesChange();
      }
    } catch (err) {
      console.error('Failed to update note:', err);
    }
  };

  if (!unit) return null;

  return (
    <div className="fixed inset-0 z-50" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Panel */}
      <div
        className="absolute right-0 top-0 h-full bg-white flex flex-col"
        style={{
          width: '400px',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.08)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${tokens.borderSubtle}`,
          }}
        >
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: tokens.textPrimary }}>
              {unit.unitNumber} {unit.address?.split(',')[0] || ''}
            </h2>
            <p style={{ fontSize: '12px', color: tokens.textSecondary, marginTop: '2px' }}>
              {unit.purchaserName || 'No purchaser assigned'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
          >
            <X size={18} style={{ color: tokens.textSecondary }} />
          </button>
        </div>

        {/* Add Note */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${tokens.borderSubtle}` }}>
          <div className="flex gap-2">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              placeholder="Add a note or query..."
              className="flex-1 outline-none"
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                border: `1px solid ${tokens.borderSubtle}`,
                borderRadius: '6px',
              }}
            />
            <button
              onClick={handleAddNote}
              disabled={!newNote.trim() || isAdding}
              className="px-3 rounded transition-colors disabled:opacity-50"
              style={{
                backgroundColor: tokens.textPrimary,
                color: '#FFFFFF',
              }}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '16px 20px' }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin" size={20} style={{ color: tokens.textTertiary }} />
            </div>
          ) : notes.length === 0 ? (
            <p style={{ textAlign: 'center', fontSize: '13px', color: tokens.textTertiary, padding: '32px 0' }}>
              No notes yet
            </p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-lg"
                  style={{
                    padding: '12px',
                    backgroundColor: note.resolved ? tokens.bgSecondary : tokens.bgPrimary,
                    border: `1px solid ${tokens.borderSubtle}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p style={{
                      fontSize: '13px',
                      color: note.resolved ? tokens.textTertiary : tokens.textPrimary,
                      textDecoration: note.resolved ? 'line-through' : 'none',
                      flex: 1,
                    }}>
                      {note.content}
                    </p>
                    <button
                      onClick={() => handleToggleResolved(note.id, note.resolved)}
                      className="p-1 rounded transition-colors"
                      style={{
                        backgroundColor: note.resolved ? tokens.statusComplete : 'transparent',
                        color: note.resolved ? tokens.statusCompleteText : tokens.textTertiary,
                      }}
                    >
                      <Check size={14} />
                    </button>
                  </div>
                  <p style={{ fontSize: '11px', color: tokens.textTertiary, marginTop: '8px' }}>
                    {new Date(note.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    {note.createdBy && ` · ${note.createdBy}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Release Units Modal
// =============================================================================

interface ReleaseUnitsModalProps {
  developmentId: string;
  onClose: () => void;
  onRelease: () => void;
}

function ReleaseUnitsModal({ developmentId, onClose, onRelease }: ReleaseUnitsModalProps) {
  const [unreleasedUnits, setUnreleasedUnits] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isReleasing, setIsReleasing] = useState(false);

  useEffect(() => {
    const fetchUnreleased = async () => {
      try {
        const response = await fetch(`/api/pipeline/${developmentId}/unreleased`);
        if (response.ok) {
          const data = await response.json();
          setUnreleasedUnits(data.units || []);
        }
      } catch (err) {
        console.error('Failed to fetch unreleased units:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUnreleased();
  }, [developmentId]);

  const handleToggle = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === unreleasedUnits.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unreleasedUnits.map(u => u.id)));
    }
  };

  const handleRelease = async () => {
    if (selectedIds.size === 0) return;

    setIsReleasing(true);
    try {
      const response = await fetch(`/api/pipeline/${developmentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitIds: Array.from(selectedIds) }),
      });

      if (response.ok) {
        onRelease();
        onClose();
      }
    } catch (err) {
      console.error('Failed to release units:', err);
    } finally {
      setIsReleasing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative bg-white rounded-lg overflow-hidden"
        style={{
          width: '480px',
          maxHeight: '80vh',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${tokens.borderSubtle}`,
          }}
        >
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: tokens.textPrimary }}>
            Release Units
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
          >
            <X size={18} style={{ color: tokens.textSecondary }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin" size={20} style={{ color: tokens.textTertiary }} />
            </div>
          ) : unreleasedUnits.length === 0 ? (
            <p style={{ textAlign: 'center', fontSize: '13px', color: tokens.textTertiary, padding: '48px 20px' }}>
              All units have been released
            </p>
          ) : (
            <>
              {/* Select All */}
              <div
                className="flex items-center gap-3 cursor-pointer"
                style={{
                  padding: '12px 20px',
                  borderBottom: `1px solid ${tokens.borderSubtle}`,
                  backgroundColor: tokens.bgSecondary,
                }}
                onClick={handleSelectAll}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.size === unreleasedUnits.length}
                  onChange={handleSelectAll}
                  className="w-4 h-4"
                />
                <span style={{ fontSize: '12px', fontWeight: 500, color: tokens.textSecondary }}>
                  Select All ({unreleasedUnits.length} units)
                </span>
              </div>

              {/* Unit List */}
              {unreleasedUnits.map((unit) => (
                <div
                  key={unit.id}
                  className="flex items-center gap-3 cursor-pointer transition-colors"
                  style={{
                    padding: '12px 20px',
                    borderBottom: `1px solid ${tokens.borderSubtle}`,
                  }}
                  onClick={() => handleToggle(unit.id)}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.bgSecondary}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(unit.id)}
                    onChange={() => handleToggle(unit.id)}
                    className="w-4 h-4"
                  />
                  <span style={{ fontSize: '13px', color: tokens.textPrimary }}>
                    {unit.unitNumber} {unit.address}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3"
          style={{
            padding: '16px 20px',
            borderTop: `1px solid ${tokens.borderSubtle}`,
          }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded transition-colors"
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: tokens.textSecondary,
              backgroundColor: tokens.bgSecondary,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleRelease}
            disabled={selectedIds.size === 0 || isReleasing}
            className="px-4 py-2 rounded transition-colors disabled:opacity-50"
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: '#FFFFFF',
              backgroundColor: tokens.textPrimary,
            }}
          >
            {isReleasing ? 'Releasing...' : `Release ${selectedIds.size} Unit${selectedIds.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function PipelineDevelopmentPage() {
  const params = useParams();
  const router = useRouter();
  const developmentId = params.developmentId as string;

  const [development, setDevelopment] = useState<Development | null>(null);
  const [units, setUnits] = useState<PipelineUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<PipelineUnit | null>(null);
  const [showReleaseModal, setShowReleaseModal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/pipeline/${developmentId}`);
      if (!response.ok) throw new Error('Failed to fetch data');
      const data = await response.json();
      setDevelopment(data.development);
      setUnits(data.units || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading data');
    } finally {
      setIsLoading(false);
    }
  }, [developmentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdate = async (unitId: string, field: string, value: string) => {
    // Optimistic update
    setUnits(prev => prev.map(u => {
      if (u.id === unitId) {
        return { ...u, [field]: value };
      }
      return u;
    }));

    try {
      const response = await fetch(`/api/pipeline/${developmentId}/${unitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value }),
      });

      if (!response.ok) {
        fetchData();
      }
    } catch (err) {
      fetchData();
    }
  };

  const handleQueriesClick = (unit: PipelineUnit) => {
    setSelectedUnit(unit);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin" size={24} style={{ color: tokens.textTertiary }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p style={{ color: tokens.alertBadge, fontSize: '14px' }}>{error}</p>
      </div>
    );
  }

  // Column definitions
  const columns = [
    { key: 'unit', label: 'UNIT', width: '140px', frozen: true },
    { key: 'name', label: 'NAME', width: '180px' },
    { key: 'releaseDate', label: 'RELEASE', width: '72px' },
    { key: 'saleAgreedDate', label: 'AGREED', width: '72px' },
    { key: 'depositDate', label: 'DEPOSIT', width: '72px' },
    { key: 'contractsIssuedDate', label: 'CONTRACTS OUT', width: '90px' },
    { key: 'queries', label: 'QUERIES', width: '50px' },
    { key: 'signedContractsDate', label: 'SIGNED IN', width: '72px' },
    { key: 'counterSignedDate', label: 'COUNTER SIGNED', width: '95px' },
    { key: 'kitchenDate', label: 'KITCHEN', width: '70px' },
    { key: 'snagDate', label: 'SNAG', width: '60px' },
    { key: 'drawdownDate', label: 'DRAWDOWN', width: '80px' },
    { key: 'handoverDate', label: 'HANDOVER', width: '80px' },
  ];

  return (
    <>
      {/* Load DM Sans */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
      `}</style>

      <div className="min-h-screen bg-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: '16px 24px',
            borderBottom: `1px solid ${tokens.borderSubtle}`,
          }}
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/developer/pipeline')}
              className="p-2 rounded transition-colors hover:bg-gray-100"
            >
              <ArrowLeft size={18} style={{ color: tokens.textSecondary }} />
            </button>
            <h1 style={{ fontSize: '16px', fontWeight: 600, color: tokens.textPrimary }}>
              {development?.name || 'Pipeline'}
            </h1>
          </div>
          <button
            onClick={() => setShowReleaseModal(true)}
            className="px-4 py-2 rounded transition-colors"
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: '#FFFFFF',
              backgroundColor: tokens.textPrimary,
            }}
          >
            Release Units
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table
            className="w-full"
            style={{
              borderCollapse: 'collapse',
              minWidth: '1200px',
            }}
          >
            {/* Header */}
            <thead>
              <tr style={{ backgroundColor: tokens.bgSecondary }}>
                {columns.map((col, i) => (
                  <th
                    key={col.key}
                    style={{
                      height: '40px',
                      padding: '0 12px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: tokens.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                      textAlign: 'left',
                      borderRight: i < columns.length - 1 ? `1px solid ${tokens.borderSubtle}` : 'none',
                      borderBottom: `1px solid ${tokens.borderSubtle}`,
                      whiteSpace: 'nowrap',
                      minWidth: col.width,
                      position: col.frozen ? 'sticky' : 'relative',
                      left: col.frozen ? 0 : 'auto',
                      zIndex: col.frozen ? 20 : 10,
                      backgroundColor: tokens.bgSecondary,
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {units.map((unit) => (
                <tr
                  key={unit.id}
                  className="transition-colors"
                  onMouseEnter={(e) => {
                    const cells = e.currentTarget.querySelectorAll('td');
                    cells.forEach(cell => {
                      if (!cell.classList.contains('date-complete')) {
                        cell.style.backgroundColor = tokens.bgSecondary;
                      }
                    });
                  }}
                  onMouseLeave={(e) => {
                    const cells = e.currentTarget.querySelectorAll('td');
                    cells.forEach(cell => {
                      if (!cell.classList.contains('date-complete')) {
                        cell.style.backgroundColor = 'transparent';
                      }
                    });
                  }}
                >
                  {/* Unit (frozen) */}
                  <td
                    style={{
                      height: '36px',
                      padding: '0 12px',
                      fontSize: '11px',
                      fontWeight: 500,
                      color: tokens.textPrimary,
                      borderRight: `1px solid ${tokens.borderSubtle}`,
                      borderBottom: `1px solid ${tokens.borderSubtle}`,
                      minWidth: '140px',
                      position: 'sticky',
                      left: 0,
                      backgroundColor: tokens.bgPrimary,
                      zIndex: 5,
                      boxShadow: '2px 0 4px rgba(0, 0, 0, 0.03)',
                    }}
                  >
                    {unit.unitNumber} {unit.address?.split(',')[0]?.replace(unit.unitNumber, '').trim() || ''}
                  </td>

                  {/* Name */}
                  <NameCell
                    value={unit.purchaserName}
                    unitId={unit.id}
                    onUpdate={handleUpdate}
                  />

                  {/* Date columns */}
                  <DateCell value={unit.releaseDate} unitId={unit.id} field="releaseDate" onUpdate={handleUpdate} />
                  <DateCell value={unit.saleAgreedDate} unitId={unit.id} field="saleAgreedDate" onUpdate={handleUpdate} />
                  <DateCell value={unit.depositDate} unitId={unit.id} field="depositDate" onUpdate={handleUpdate} />
                  <DateCell value={unit.contractsIssuedDate} unitId={unit.id} field="contractsIssuedDate" onUpdate={handleUpdate} />

                  {/* Queries */}
                  <QueriesCell
                    count={unit.notesCount}
                    unresolvedCount={unit.unresolvedNotesCount}
                    onClick={() => handleQueriesClick(unit)}
                  />

                  {/* More date columns */}
                  <DateCell value={unit.signedContractsDate} unitId={unit.id} field="signedContractsDate" onUpdate={handleUpdate} />
                  <DateCell value={unit.counterSignedDate} unitId={unit.id} field="counterSignedDate" onUpdate={handleUpdate} />
                  <DateCell value={unit.kitchenDate} unitId={unit.id} field="kitchenDate" onUpdate={handleUpdate} />
                  <DateCell value={unit.snagDate} unitId={unit.id} field="snagDate" onUpdate={handleUpdate} />
                  <DateCell value={unit.drawdownDate} unitId={unit.id} field="drawdownDate" onUpdate={handleUpdate} />
                  <DateCell value={unit.handoverDate} unitId={unit.id} field="handoverDate" onUpdate={handleUpdate} />
                </tr>
              ))}
            </tbody>
          </table>

          {units.length === 0 && (
            <div
              className="flex flex-col items-center justify-center"
              style={{ padding: '64px 24px' }}
            >
              <p style={{ fontSize: '14px', color: tokens.textTertiary, marginBottom: '16px' }}>
                No units released yet.
              </p>
              <button
                onClick={() => setShowReleaseModal(true)}
                className="px-4 py-2 rounded transition-colors"
                style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#FFFFFF',
                  backgroundColor: tokens.textPrimary,
                }}
              >
                Release Units
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Queries Panel */}
      {selectedUnit && (
        <QueriesPanel
          unit={selectedUnit}
          developmentId={developmentId}
          onClose={() => setSelectedUnit(null)}
          onNotesChange={fetchData}
        />
      )}

      {/* Release Units Modal */}
      {showReleaseModal && (
        <ReleaseUnitsModal
          developmentId={developmentId}
          onClose={() => setShowReleaseModal(false)}
          onRelease={fetchData}
        />
      )}
    </>
  );
}
