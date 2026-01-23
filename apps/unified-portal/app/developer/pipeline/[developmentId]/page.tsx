'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

// =============================================================================
// Design Tokens - Exact Spec Colors
// =============================================================================

const tokens = {
  // Backgrounds
  bgWhite: '#FFFFFF',
  bgSubtle: '#F8FAFC',
  bgHover: '#F1F5F9',

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',

  // Borders
  border: '#E2E8F0',

  // Status Colors
  greenBg: '#ECFDF5',
  greenText: '#047857',
  redBadge: '#EF4444',

  // Accent
  accent: '#0EA5E9',
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
// Date Formatting - "DD MMM" format
// =============================================================================

function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = date.toLocaleDateString('en-GB', { month: 'short' });
  return `${day} ${month}`;
}

// =============================================================================
// Inline Date Picker - Small, below cell, not modal
// =============================================================================

interface DatePickerProps {
  value: string | null;
  onChange: (date: string) => void;
  onClose: () => void;
}

function InlineDatePicker({ value, onChange, onClose }: DatePickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [currentMonth, setCurrentMonth] = useState(() => value ? new Date(value) : new Date());

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
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
  const monthName = currentMonth.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

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

  const isSelected = (day: number) => day === selectedDay && month === selectedMonth && year === selectedYear;

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: '100%',
        left: '0',
        marginTop: '4px',
        backgroundColor: tokens.bgWhite,
        border: `1px solid ${tokens.border}`,
        borderRadius: '6px',
        padding: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        zIndex: 100,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <button
          onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
          style={{
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            borderRadius: '4px',
            color: tokens.textSecondary,
            fontSize: '14px',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.bgHover}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          ‹
        </button>
        <span style={{ fontSize: '11px', fontWeight: 500, color: tokens.textPrimary }}>{monthName}</span>
        <button
          onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
          style={{
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            borderRadius: '4px',
            color: tokens.textSecondary,
            fontSize: '14px',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.bgHover}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          ›
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 24px)', gap: '2px' }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} style={{ height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: tokens.textMuted }}>
            {d}
          </div>
        ))}
        {days.map((day, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {day && (
              <button
                onClick={() => handleSelect(day)}
                style={{
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  backgroundColor: isSelected(day) ? tokens.accent : 'transparent',
                  color: isSelected(day) ? '#FFFFFF' : tokens.textPrimary,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected(day)) e.currentTarget.style.backgroundColor = tokens.bgHover;
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
    </div>
  );
}

// =============================================================================
// Editable Date Cell - One Click = Today, Click Filled = Picker
// =============================================================================

interface DateCellProps {
  value: string | null;
  unitId: string;
  field: string;
  onUpdate: (unitId: string, field: string, value: string) => void;
}

function DateCell({ value, unitId, field, onUpdate }: DateCellProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [flash, setFlash] = useState(false);

  const handleClick = () => {
    if (!value) {
      // Empty cell: set today's date immediately
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      onUpdate(unitId, field, today.toISOString());
      setFlash(true);
      setTimeout(() => setFlash(false), 200);
    } else {
      setShowPicker(true);
    }
  };

  const handleChange = (newDate: string) => {
    onUpdate(unitId, field, newDate);
    setFlash(true);
    setTimeout(() => setFlash(false), 200);
  };

  const isEmpty = !value;

  return (
    <td
      onClick={handleClick}
      style={{
        position: 'relative',
        height: '36px',
        padding: '0 10px',
        borderRight: `1px solid ${tokens.border}`,
        borderBottom: `1px solid ${tokens.border}`,
        cursor: 'pointer',
        transition: 'background-color 0.1s ease',
        backgroundColor: flash ? tokens.greenBg : isEmpty ? 'transparent' : tokens.greenBg,
        minWidth: '68px',
        textAlign: 'center',
      }}
      onMouseEnter={(e) => {
        if (!flash) e.currentTarget.style.backgroundColor = tokens.bgHover;
      }}
      onMouseLeave={(e) => {
        if (!flash) e.currentTarget.style.backgroundColor = isEmpty ? 'transparent' : tokens.greenBg;
      }}
    >
      <span style={{
        fontSize: '12px',
        fontWeight: 500,
        color: isEmpty ? tokens.textMuted : tokens.greenText,
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {formatDate(value)}
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
// Editable Name Cell - Click to Edit Inline
// =============================================================================

interface NameCellProps {
  value: string | null;
  unitId: string;
  onUpdate: (unitId: string, field: string, value: string) => void;
}

function NameCell({ value, unitId, onUpdate }: NameCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
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

  if (isEditing) {
    return (
      <td style={{
        height: '36px',
        padding: '0 10px',
        borderRight: `1px solid ${tokens.border}`,
        borderBottom: `1px solid ${tokens.border}`,
        minWidth: '150px',
      }}>
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            fontSize: '12px',
            fontWeight: 500,
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
      style={{
        height: '36px',
        padding: '0 10px',
        borderRight: `1px solid ${tokens.border}`,
        borderBottom: `1px solid ${tokens.border}`,
        cursor: 'pointer',
        transition: 'background-color 0.1s ease',
        minWidth: '150px',
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.bgHover}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      <span style={{
        fontSize: '12px',
        fontWeight: 500,
        color: value ? tokens.textPrimary : tokens.textMuted,
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {value || '—'}
      </span>
    </td>
  );
}

// =============================================================================
// Queries Cell - Badge Count
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
      style={{
        height: '36px',
        padding: '0 6px',
        borderRight: `1px solid ${tokens.border}`,
        borderBottom: `1px solid ${tokens.border}`,
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'background-color 0.1s ease',
        minWidth: '54px',
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.bgHover}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      {count > 0 ? (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '20px',
          height: '20px',
          padding: '0 6px',
          borderRadius: '10px',
          fontSize: '11px',
          fontWeight: 600,
          backgroundColor: hasUnresolved ? tokens.redBadge : tokens.bgHover,
          color: hasUnresolved ? '#FFFFFF' : tokens.textMuted,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {unresolvedCount > 0 ? unresolvedCount : count}
        </span>
      ) : (
        <span style={{ color: tokens.textMuted, fontSize: '12px', fontFamily: "'DM Sans', sans-serif" }}>—</span>
      )}
    </td>
  );
}

// =============================================================================
// Queries Slide-Out Panel (Right Side, Not Modal)
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
  const panelRef = useRef<HTMLDivElement>(null);

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
        setNotes(prev => prev.map(n => n.id === noteId ? { ...n, resolved: !currentResolved } : n));
        onNotesChange();
      }
    } catch (err) {
      console.error('Failed to update note:', err);
    }
  };

  if (!unit) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, fontFamily: "'DM Sans', sans-serif" }}>
      {/* Backdrop - subtle */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.1)' }} onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          height: '100%',
          width: '360px',
          backgroundColor: tokens.bgWhite,
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${tokens.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: tokens.textPrimary, margin: 0 }}>
                {unit.unitNumber} {unit.address?.split(',')[0]?.replace(unit.unitNumber, '').trim() || ''}
              </h2>
              <p style={{ fontSize: '12px', color: tokens.textSecondary, margin: '2px 0 0 0' }}>
                {unit.purchaserName || 'No purchaser'}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                borderRadius: '4px',
                color: tokens.textSecondary,
                fontSize: '18px',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.bgHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              ×
            </button>
          </div>
        </div>

        {/* Add Note Input */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${tokens.border}` }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              placeholder="Add a note..."
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '13px',
                border: `1px solid ${tokens.border}`,
                borderRadius: '6px',
                outline: 'none',
                fontFamily: "'DM Sans', sans-serif",
              }}
            />
            <button
              onClick={handleAddNote}
              disabled={!newNote.trim() || isAdding}
              style={{
                padding: '0 14px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: tokens.textPrimary,
                color: '#FFFFFF',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                opacity: (!newNote.trim() || isAdding) ? 0.5 : 1,
              }}
            >
              Add
            </button>
          </div>
        </div>

        {/* Notes List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {isLoading ? (
            <p style={{ textAlign: 'center', color: tokens.textMuted, fontSize: '13px', padding: '24px 0' }}>Loading...</p>
          ) : notes.length === 0 ? (
            <p style={{ textAlign: 'center', color: tokens.textMuted, fontSize: '13px', padding: '24px 0' }}>No notes yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {notes.map((note) => (
                <div
                  key={note.id}
                  style={{
                    padding: '12px',
                    borderRadius: '6px',
                    backgroundColor: note.resolved ? tokens.bgSubtle : tokens.bgWhite,
                    border: `1px solid ${tokens.border}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <p style={{
                      flex: 1,
                      fontSize: '13px',
                      color: note.resolved ? tokens.textMuted : tokens.textPrimary,
                      textDecoration: note.resolved ? 'line-through' : 'none',
                      margin: 0,
                      lineHeight: 1.4,
                    }}>
                      {note.content}
                    </p>
                    <button
                      onClick={() => handleToggleResolved(note.id, note.resolved)}
                      style={{
                        width: '22px',
                        height: '22px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1px solid ${note.resolved ? tokens.greenText : tokens.border}`,
                        borderRadius: '4px',
                        backgroundColor: note.resolved ? tokens.greenBg : 'transparent',
                        cursor: 'pointer',
                        flexShrink: 0,
                        color: note.resolved ? tokens.greenText : tokens.textMuted,
                        fontSize: '12px',
                      }}
                    >
                      {note.resolved ? '✓' : ''}
                    </button>
                  </div>
                  <p style={{ fontSize: '11px', color: tokens.textMuted, margin: '8px 0 0 0' }}>
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
// Release Units Modal (Only Modal Allowed Per Spec)
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
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === unreleasedUnits.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(unreleasedUnits.map(u => u.id)));
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.2)' }} onClick={onClose} />
      <div style={{
        position: 'relative',
        backgroundColor: tokens.bgWhite,
        borderRadius: '8px',
        width: '420px',
        maxHeight: '70vh',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${tokens.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: tokens.textPrimary, margin: 0 }}>Release Units</h2>
          <button
            onClick={onClose}
            style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', borderRadius: '4px', color: tokens.textSecondary, fontSize: '18px' }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {isLoading ? (
            <p style={{ textAlign: 'center', color: tokens.textMuted, fontSize: '13px', padding: '40px 0' }}>Loading...</p>
          ) : unreleasedUnits.length === 0 ? (
            <p style={{ textAlign: 'center', color: tokens.textMuted, fontSize: '13px', padding: '40px 20px' }}>All units have been released</p>
          ) : (
            <>
              {/* Select All */}
              <div
                onClick={handleSelectAll}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', borderBottom: `1px solid ${tokens.border}`, backgroundColor: tokens.bgSubtle, cursor: 'pointer' }}
              >
                <input type="checkbox" checked={selectedIds.size === unreleasedUnits.length} onChange={handleSelectAll} style={{ width: '16px', height: '16px' }} />
                <span style={{ fontSize: '12px', fontWeight: 500, color: tokens.textSecondary }}>Select All ({unreleasedUnits.length})</span>
              </div>
              {/* Unit List */}
              {unreleasedUnits.map((unit) => (
                <div
                  key={unit.id}
                  onClick={() => handleToggle(unit.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 20px',
                    borderBottom: `1px solid ${tokens.border}`,
                    cursor: 'pointer',
                    transition: 'background-color 0.1s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.bgSubtle}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <input type="checkbox" checked={selectedIds.has(unit.id)} onChange={() => handleToggle(unit.id)} style={{ width: '16px', height: '16px' }} />
                  <span style={{ fontSize: '13px', color: tokens.textPrimary }}>{unit.unitNumber} {unit.address}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: `1px solid ${tokens.border}`, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 500, color: tokens.textSecondary, backgroundColor: tokens.bgSubtle, border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleRelease}
            disabled={selectedIds.size === 0 || isReleasing}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#FFFFFF',
              backgroundColor: tokens.textPrimary,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              opacity: (selectedIds.size === 0 || isReleasing) ? 0.5 : 1,
            }}
          >
            {isReleasing ? 'Releasing...' : `Release ${selectedIds.size}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Page - The Pipeline Table
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
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setIsLoading(false);
    }
  }, [developmentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdate = async (unitId: string, field: string, value: string) => {
    // Optimistic update
    setUnits(prev => prev.map(u => u.id === unitId ? { ...u, [field]: value } : u));

    try {
      const response = await fetch(`/api/pipeline/${developmentId}/${unitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value }),
      });
      if (!response.ok) fetchData();
    } catch {
      fetchData();
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: tokens.bgWhite, fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
        <p style={{ color: tokens.textMuted, fontSize: '13px' }}>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: tokens.bgWhite, fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
        <p style={{ color: tokens.redBadge, fontSize: '13px' }}>{error}</p>
      </div>
    );
  }

  // Column definitions - exactly 13 columns per spec
  const dateColumns = [
    { key: 'releaseDate', label: 'RELEASE' },
    { key: 'saleAgreedDate', label: 'AGREED' },
    { key: 'depositDate', label: 'DEPOSIT' },
    { key: 'contractsIssuedDate', label: 'CONTRACTS OUT' },
    { key: 'signedContractsDate', label: 'SIGNED IN' },
    { key: 'counterSignedDate', label: 'COUNTER SIGNED' },
    { key: 'kitchenDate', label: 'KITCHEN' },
    { key: 'snagDate', label: 'SNAG' },
    { key: 'drawdownDate', label: 'DRAWDOWN' },
    { key: 'handoverDate', label: 'HANDOVER' },
  ];

  return (
    <>
      <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>

      <div style={{ minHeight: '100vh', backgroundColor: tokens.bgWhite, fontFamily: "'DM Sans', sans-serif" }}>
        {/* Header - Simple: Back + Title + Release Button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: `1px solid ${tokens.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => router.push('/developer/pipeline')}
              style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                borderRadius: '6px',
                color: tokens.textSecondary,
                fontSize: '18px',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = tokens.bgHover}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              ←
            </button>
            <h1 style={{
              fontSize: '16px',
              fontWeight: 600,
              color: tokens.textPrimary,
              margin: 0,
              letterSpacing: '-0.01em',
            }}>
              {development?.name || 'Pipeline'}
            </h1>
          </div>
          <button
            onClick={() => setShowReleaseModal(true)}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#FFFFFF',
              backgroundColor: tokens.textPrimary,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Release Units
          </button>
        </div>

        {/* The Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1200px' }}>
            <thead>
              <tr style={{ backgroundColor: tokens.bgSubtle }}>
                {/* UNIT Column - Frozen */}
                <th style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 20,
                  height: '40px',
                  padding: '0 12px',
                  textAlign: 'left',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: tokens.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  borderRight: `1px solid ${tokens.border}`,
                  borderBottom: `1px solid ${tokens.border}`,
                  backgroundColor: tokens.bgSubtle,
                  minWidth: '130px',
                }}>
                  Unit
                </th>
                {/* NAME Column */}
                <th style={{
                  height: '40px',
                  padding: '0 12px',
                  textAlign: 'left',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: tokens.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  borderRight: `1px solid ${tokens.border}`,
                  borderBottom: `1px solid ${tokens.border}`,
                  minWidth: '150px',
                }}>
                  Name
                </th>
                {/* Date Columns Before Queries */}
                {dateColumns.slice(0, 4).map((col) => (
                  <th key={col.key} style={{
                    height: '40px',
                    padding: '0 10px',
                    textAlign: 'center',
                    fontSize: '10px',
                    fontWeight: 600,
                    color: tokens.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                    borderRight: `1px solid ${tokens.border}`,
                    borderBottom: `1px solid ${tokens.border}`,
                    minWidth: '70px',
                    whiteSpace: 'nowrap',
                  }}>
                    {col.label}
                  </th>
                ))}
                {/* QUERIES Column */}
                <th style={{
                  height: '40px',
                  padding: '0 6px',
                  textAlign: 'center',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: tokens.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  borderRight: `1px solid ${tokens.border}`,
                  borderBottom: `1px solid ${tokens.border}`,
                  minWidth: '54px',
                }}>
                  Queries
                </th>
                {/* Remaining Date Columns */}
                {dateColumns.slice(4).map((col) => (
                  <th key={col.key} style={{
                    height: '40px',
                    padding: '0 10px',
                    textAlign: 'center',
                    fontSize: '10px',
                    fontWeight: 600,
                    color: tokens.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                    borderRight: `1px solid ${tokens.border}`,
                    borderBottom: `1px solid ${tokens.border}`,
                    minWidth: '70px',
                    whiteSpace: 'nowrap',
                  }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id}>
                  {/* UNIT Cell - Frozen */}
                  <td style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 10,
                    height: '36px',
                    padding: '0 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: tokens.textPrimary,
                    borderRight: `1px solid ${tokens.border}`,
                    borderBottom: `1px solid ${tokens.border}`,
                    backgroundColor: tokens.bgWhite,
                    boxShadow: '2px 0 4px rgba(0, 0, 0, 0.03)',
                    minWidth: '130px',
                    whiteSpace: 'nowrap',
                  }}>
                    {unit.unitNumber} {unit.address?.split(',')[0]?.replace(unit.unitNumber, '').trim() || ''}
                  </td>
                  {/* NAME Cell */}
                  <NameCell value={unit.purchaserName} unitId={unit.id} onUpdate={handleUpdate} />
                  {/* Date Cells Before Queries */}
                  <DateCell value={unit.releaseDate} unitId={unit.id} field="releaseDate" onUpdate={handleUpdate} />
                  <DateCell value={unit.saleAgreedDate} unitId={unit.id} field="saleAgreedDate" onUpdate={handleUpdate} />
                  <DateCell value={unit.depositDate} unitId={unit.id} field="depositDate" onUpdate={handleUpdate} />
                  <DateCell value={unit.contractsIssuedDate} unitId={unit.id} field="contractsIssuedDate" onUpdate={handleUpdate} />
                  {/* Queries Cell */}
                  <QueriesCell count={unit.notesCount} unresolvedCount={unit.unresolvedNotesCount} onClick={() => setSelectedUnit(unit)} />
                  {/* Remaining Date Cells */}
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
            <div style={{ padding: '64px 24px', textAlign: 'center' }}>
              <p style={{ color: tokens.textMuted, fontSize: '14px', marginBottom: '16px' }}>
                No units released yet.
              </p>
              <button
                onClick={() => setShowReleaseModal(true)}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#FFFFFF',
                  backgroundColor: tokens.textPrimary,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
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
