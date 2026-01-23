'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, X, Plus, Check } from 'lucide-react';

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
  const day = date.getDate().toString().padStart(2, '0');
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

  const days = [];
  const startDay = firstDay === 0 ? 6 : firstDay - 1; // Monday start
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const handleSelect = (day: number) => {
    const selected = new Date(year, month, day, 12, 0, 0);
    onChange(selected.toISOString());
    onClose();
  };

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 bg-white border border-[#E2E8F0] rounded-lg shadow-lg z-50 p-2"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <button onClick={prevMonth} className="p-1 hover:bg-[#F8FAFC] rounded">←</button>
        <span className="text-sm font-medium text-[#0F172A]">{monthName}</span>
        <button onClick={nextMonth} className="p-1 hover:bg-[#F8FAFC] rounded">→</button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-xs">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="w-7 h-6 flex items-center justify-center text-[#94A3B8] font-medium">
            {d}
          </div>
        ))}
        {days.map((day, i) => (
          <div key={i} className="w-7 h-7 flex items-center justify-center">
            {day && (
              <button
                onClick={() => handleSelect(day)}
                className="w-6 h-6 rounded hover:bg-[#ECFDF5] text-[#0F172A] text-xs"
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
  const [isUpdating, setIsUpdating] = useState(false);

  const handleClick = () => {
    if (isUpdating) return;

    if (!value) {
      // Empty cell: set today's date immediately
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      onUpdate(unitId, field, today.toISOString());
    } else {
      // Filled cell: show picker
      setShowPicker(true);
    }
  };

  const handleChange = (newDate: string) => {
    onUpdate(unitId, field, newDate);
  };

  const isEmpty = !value;
  const displayValue = formatDate(value);

  return (
    <td
      className="relative px-3 border-r border-[#E2E8F0] cursor-pointer select-none"
      style={{
        height: '36px',
        backgroundColor: isEmpty ? '#F8FAFC' : '#ECFDF5',
        minWidth: '80px',
      }}
      onClick={handleClick}
    >
      <span
        className="text-sm"
        style={{
          color: isEmpty ? '#94A3B8' : '#047857',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {isUpdating ? '...' : displayValue}
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

  const isEmpty = !value;

  if (isEditing) {
    return (
      <td
        className="px-3 border-r border-[#E2E8F0]"
        style={{ height: '36px', minWidth: '160px' }}
      >
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-full h-full bg-transparent text-sm text-[#0F172A] outline-none"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        />
      </td>
    );
  }

  return (
    <td
      className="px-3 border-r border-[#E2E8F0] cursor-pointer"
      style={{
        height: '36px',
        minWidth: '160px',
        backgroundColor: isEmpty ? '#F8FAFC' : '#FFFFFF',
      }}
      onClick={handleClick}
    >
      <span
        className="text-sm"
        style={{
          color: isEmpty ? '#94A3B8' : '#0F172A',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
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
      className="px-3 border-r border-[#E2E8F0] cursor-pointer text-center"
      style={{ height: '36px', minWidth: '70px' }}
      onClick={onClick}
    >
      {count > 0 ? (
        <span
          className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-medium"
          style={{
            backgroundColor: hasUnresolved ? '#EF4444' : '#94A3B8',
            color: '#FFFFFF',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {unresolvedCount > 0 ? unresolvedCount : count}
        </span>
      ) : (
        <span className="text-sm text-[#94A3B8]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
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
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch notes
  useEffect(() => {
    if (!unit?.pipelineId) {
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

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Add note
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

  // Toggle resolved
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
      {/* Backdrop - clicking closes panel */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Panel - slides in from right */}
      <div
        ref={panelRef}
        className="absolute right-0 top-0 h-full w-96 bg-white shadow-xl flex flex-col"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#0F172A]">
              Queries - {unit.unitNumber}
            </h2>
            <p className="text-xs text-[#475569]">{unit.purchaserName || 'No purchaser'}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#F8FAFC] rounded">
            <X className="w-5 h-5 text-[#475569]" />
          </button>
        </div>

        {/* Add Note */}
        <div className="px-4 py-3 border-b border-[#E2E8F0]">
          <div className="flex gap-2">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              placeholder="Add a note..."
              className="flex-1 px-3 py-2 text-sm border border-[#E2E8F0] rounded focus:outline-none focus:ring-1 focus:ring-[#047857]"
            />
            <button
              onClick={handleAddNote}
              disabled={!newNote.trim() || isAdding}
              className="px-3 py-2 bg-[#0F172A] text-white text-sm rounded hover:bg-[#1E293B] disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[#94A3B8]" />
            </div>
          ) : notes.length === 0 ? (
            <p className="text-center text-sm text-[#94A3B8] py-8">No notes yet</p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className={`p-3 rounded border ${note.resolved ? 'bg-[#F8FAFC] border-[#E2E8F0]' : 'bg-white border-[#E2E8F0]'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm flex-1 ${note.resolved ? 'text-[#94A3B8] line-through' : 'text-[#0F172A]'}`}>
                      {note.content}
                    </p>
                    <button
                      onClick={() => handleToggleResolved(note.id, note.resolved)}
                      className={`p-1 rounded ${note.resolved ? 'bg-[#ECFDF5] text-[#047857]' : 'hover:bg-[#F8FAFC] text-[#94A3B8]'}`}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-[#94A3B8] mt-1">
                    {new Date(note.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {note.createdBy && ` • ${note.createdBy}`}
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

  // Fetch data
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

  // Update field
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
        // Revert on error
        fetchData();
      }
    } catch (err) {
      fetchData();
    }
  };

  // Handle queries click - open slide-out panel
  const handleQueriesClick = (unit: PipelineUnit) => {
    setSelectedUnit(unit);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#94A3B8]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-[#EF4444]">{error}</p>
      </div>
    );
  }

  return (
    <>
      {/* Load DM Sans font */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
      `}</style>

      <div className="min-h-screen bg-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        {/* Header */}
        <div className="border-b border-[#E2E8F0] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/developer/pipeline')}
              className="p-2 hover:bg-[#F8FAFC] rounded"
            >
              <ArrowLeft className="w-5 h-5 text-[#475569]" />
            </button>
            <h1 className="text-lg font-semibold text-[#0F172A]">
              {development?.name || 'Pipeline'}
            </h1>
          </div>
          <button
            onClick={() => {/* Release units - placeholder */}}
            className="px-4 py-2 bg-[#0F172A] text-white text-sm font-medium rounded hover:bg-[#1E293B]"
          >
            Release Units
          </button>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: '1200px' }}>
            {/* Header Row */}
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <th className="px-3 text-left text-xs font-semibold text-[#475569] uppercase tracking-wider border-r border-[#E2E8F0]" style={{ height: '36px', minWidth: '140px' }}>
                  Unit
                </th>
                <th className="px-3 text-left text-xs font-semibold text-[#475569] uppercase tracking-wider border-r border-[#E2E8F0]" style={{ height: '36px', minWidth: '160px' }}>
                  Name
                </th>
                <th className="px-3 text-left text-xs font-semibold text-[#475569] uppercase tracking-wider border-r border-[#E2E8F0]" style={{ height: '36px', minWidth: '80px' }}>
                  Release
                </th>
                <th className="px-3 text-left text-xs font-semibold text-[#475569] uppercase tracking-wider border-r border-[#E2E8F0]" style={{ height: '36px', minWidth: '80px' }}>
                  Agreed
                </th>
                <th className="px-3 text-left text-xs font-semibold text-[#475569] uppercase tracking-wider border-r border-[#E2E8F0]" style={{ height: '36px', minWidth: '80px' }}>
                  Deposit
                </th>
                <th className="px-3 text-left text-xs font-semibold text-[#475569] uppercase tracking-wider border-r border-[#E2E8F0]" style={{ height: '36px', minWidth: '90px' }}>
                  Contracts Out
                </th>
                <th className="px-3 text-center text-xs font-semibold text-[#475569] uppercase tracking-wider border-r border-[#E2E8F0]" style={{ height: '36px', minWidth: '70px' }}>
                  Queries
                </th>
                <th className="px-3 text-left text-xs font-semibold text-[#475569] uppercase tracking-wider border-r border-[#E2E8F0]" style={{ height: '36px', minWidth: '80px' }}>
                  Signed In
                </th>
                <th className="px-3 text-left text-xs font-semibold text-[#475569] uppercase tracking-wider border-r border-[#E2E8F0]" style={{ height: '36px', minWidth: '100px' }}>
                  Counter Signed
                </th>
                <th className="px-3 text-left text-xs font-semibold text-[#475569] uppercase tracking-wider border-r border-[#E2E8F0]" style={{ height: '36px', minWidth: '80px' }}>
                  Kitchen
                </th>
                <th className="px-3 text-left text-xs font-semibold text-[#475569] uppercase tracking-wider border-r border-[#E2E8F0]" style={{ height: '36px', minWidth: '70px' }}>
                  Snag
                </th>
                <th className="px-3 text-left text-xs font-semibold text-[#475569] uppercase tracking-wider border-r border-[#E2E8F0]" style={{ height: '36px', minWidth: '90px' }}>
                  Drawdown
                </th>
                <th className="px-3 text-left text-xs font-semibold text-[#475569] uppercase tracking-wider" style={{ height: '36px', minWidth: '90px' }}>
                  Handover
                </th>
              </tr>
            </thead>

            {/* Data Rows */}
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC]/50">
                  {/* Unit Address - not editable */}
                  <td
                    className="px-3 border-r border-[#E2E8F0] text-sm text-[#0F172A]"
                    style={{ height: '36px', minWidth: '140px' }}
                  >
                    {unit.unitNumber} {unit.address?.split(',')[0] || ''}
                  </td>

                  {/* Name - editable */}
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
            <div className="text-center py-12 text-[#94A3B8]">
              No units in pipeline. Click "Release Units" to add units.
            </div>
          )}
        </div>
      </div>

      {/* Queries Slide-Out Panel */}
      {selectedUnit && (
        <QueriesPanel
          unit={selectedUnit}
          developmentId={developmentId}
          onClose={() => setSelectedUnit(null)}
          onNotesChange={fetchData}
        />
      )}
    </>
  );
}
