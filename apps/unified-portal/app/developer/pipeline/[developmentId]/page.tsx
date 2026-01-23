'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  AlertCircle,
  MessageSquare,
  Plus,
  Calendar,
  X,
  Check,
  Search,
  Loader2,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface PipelineUnit {
  id: string;
  pipelineId: string | null;
  unitNumber: string;
  address: string;
  houseTypeCode: string;
  purchaserName: string | null;
  purchaserEmail: string | null;
  purchaserPhone: string | null;
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
  code: string;
  address: string;
}

interface Note {
  id: string;
  noteType: string;
  content: string;
  isResolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
  } | null;
  resolvedBy: {
    id: string;
    name: string;
  } | null;
}

// ============================================================================
// Pipeline Column Configuration
// ============================================================================

const PIPELINE_COLUMNS = [
  { key: 'address', label: 'Unit', width: 140, frozen: true, type: 'text' as const },
  { key: 'purchaserName', label: 'Name', width: 180, type: 'text' as const, editable: true },
  { key: 'releaseDate', label: 'Release', width: 80, type: 'date' as const, editable: true },
  { key: 'saleAgreedDate', label: 'Sale Agreed', width: 85, type: 'date' as const, editable: true },
  { key: 'depositDate', label: 'Deposit', width: 80, type: 'date' as const, editable: true },
  { key: 'contractsIssuedDate', label: 'Contracts Out', width: 90, type: 'date' as const, editable: true },
  { key: 'notes', label: 'Queries', width: 60, type: 'notes' as const },
  { key: 'signedContractsDate', label: 'Signed In', width: 80, type: 'date' as const, editable: true },
  { key: 'counterSignedDate', label: 'Counter Signed', width: 100, type: 'date' as const, editable: true },
  { key: 'kitchenDate', label: 'Kitchen', width: 70, type: 'date' as const, editable: true },
  { key: 'snagDate', label: 'Snag', width: 70, type: 'date' as const, editable: true },
  { key: 'drawdownDate', label: 'Drawdown', width: 80, type: 'date' as const, editable: true },
  { key: 'handoverDate', label: 'Handover', width: 80, type: 'date' as const, editable: true },
] as const;

// ============================================================================
// Utility Functions
// ============================================================================

function formatDate(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}

function formatDateForInput(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}

function parseInputDate(value: string): string | null {
  if (!value) return null;
  // Handle various formats: "15/1", "15/1/25", "15 jan", "2025-01-15"
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date.toISOString();
  }
  return null;
}

// ============================================================================
// Date Cell Component
// ============================================================================

interface DateCellProps {
  value: string | null;
  unitId: string;
  field: string;
  onUpdate: (unitId: string, field: string, value: string | null) => Promise<void>;
  isOptimistic?: boolean;
}

function DateCell({ value, unitId, field, onUpdate, isOptimistic }: DateCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    if (!value) {
      // Empty cell - set to today
      const today = new Date().toISOString();
      onUpdate(unitId, field, today);
    } else {
      // Has value - open picker
      setInputValue(formatDateForInput(value));
      setIsEditing(true);
    }
  }, [value, unitId, field, onUpdate]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const newDate = inputValue ? new Date(inputValue).toISOString() : null;
      await onUpdate(unitId, field, newDate);
    } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
  }, [inputValue, unitId, field, onUpdate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        setIsEditing(false);
      }
    },
    [handleSave]
  );

  const handleClear = useCallback(async () => {
    setIsSaving(true);
    try {
      await onUpdate(unitId, field, null);
    } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
  }, [unitId, field, onUpdate]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.showPicker?.();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <div className="relative">
        <input
          ref={inputRef}
          type="date"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="w-full h-full px-2 py-1 text-[11px] bg-white border-2 border-[#0EA5E9] rounded focus:outline-none"
          disabled={isSaving}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-[#94A3B8] hover:text-[#EF4444]"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'w-full h-full px-3 py-2 text-left text-[11px] transition-colors',
        value
          ? 'bg-[#ECFDF5] text-[#047857] font-medium'
          : 'text-[#94A3B8] hover:bg-[#F1F5F9]',
        isOptimistic && 'animate-pulse'
      )}
    >
      {value ? formatDate(value) : '—'}
    </button>
  );
}

// ============================================================================
// Text Cell Component (for Purchaser Name)
// ============================================================================

interface TextCellProps {
  value: string | null;
  unitId: string;
  field: string;
  onUpdate: (unitId: string, field: string, value: string | null) => Promise<void>;
  isOptimistic?: boolean;
}

function TextCell({ value, unitId, field, onUpdate, isOptimistic }: TextCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    setInputValue(value || '');
    setIsEditing(true);
  }, [value]);

  const handleSave = useCallback(async () => {
    if (inputValue !== value) {
      setIsSaving(true);
      try {
        await onUpdate(unitId, field, inputValue || null);
      } finally {
        setIsSaving(false);
      }
    }
    setIsEditing(false);
  }, [inputValue, value, unitId, field, onUpdate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        setIsEditing(false);
      }
    },
    [handleSave]
  );

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        className="w-full h-full px-2 py-1 text-[11px] bg-white border-2 border-[#0EA5E9] rounded focus:outline-none"
        disabled={isSaving}
        placeholder="Enter name..."
      />
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'w-full h-full px-3 py-2 text-left text-[11px] truncate transition-colors hover:bg-[#F1F5F9]',
        value ? 'text-[#0F172A]' : 'text-[#94A3B8]',
        isOptimistic && 'animate-pulse'
      )}
      title={value || undefined}
    >
      {value || '—'}
    </button>
  );
}

// ============================================================================
// Notes Cell Component
// ============================================================================

interface NotesCellProps {
  unit: PipelineUnit;
  onClick: () => void;
}

function NotesCell({ unit, onClick }: NotesCellProps) {
  const hasUnresolved = unit.unresolvedNotesCount > 0;
  const hasNotes = unit.notesCount > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full h-full flex items-center justify-center transition-colors hover:bg-[#F1F5F9]',
        hasUnresolved && 'bg-[#FEF2F2]'
      )}
    >
      {hasUnresolved ? (
        <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#EF4444] text-white text-[11px] font-semibold">
          {unit.unresolvedNotesCount}
        </span>
      ) : hasNotes ? (
        <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#F1F5F9] text-[#94A3B8] text-[11px] font-semibold">
          {unit.notesCount}
        </span>
      ) : (
        <span className="text-[#CBD5E1]">—</span>
      )}
    </button>
  );
}

// ============================================================================
// Notes Panel Component
// ============================================================================

interface NotesPanelProps {
  unit: PipelineUnit;
  developmentId: string;
  onClose: () => void;
  onNotesUpdated: () => void;
}

function NotesPanel({ unit, developmentId, onClose, onNotesUpdated }: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteType, setNewNoteType] = useState<'general' | 'query' | 'issue'>('general');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch notes
  useEffect(() => {
    async function fetchNotes() {
      try {
        const response = await fetch(
          `/api/pipeline/${developmentId}/${unit.id}/notes`
        );
        if (response.ok) {
          const data = await response.json();
          setNotes(data.notes || []);
        }
      } catch (error) {
        console.error('Failed to fetch notes:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchNotes();
  }, [developmentId, unit.id]);

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/pipeline/${developmentId}/${unit.id}/notes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: newNoteContent.trim(),
            noteType: newNoteType,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setNotes([data.note, ...notes]);
        setNewNoteContent('');
        onNotesUpdated();
      }
    } catch (error) {
      console.error('Failed to add note:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveNote = async (noteId: string, isResolved: boolean) => {
    try {
      const response = await fetch(
        `/api/pipeline/${developmentId}/${unit.id}/notes`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ noteId, isResolved }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setNotes(notes.map((n) => (n.id === noteId ? data.note : n)));
        onNotesUpdated();
      }
    } catch (error) {
      console.error('Failed to resolve note:', error);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[400px] bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.08)] z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-[#E2E8F0]">
        <div>
          <h2 className="text-base font-semibold text-[#0F172A]">{unit.address}</h2>
          <p className="text-xs text-[#94A3B8]">Unit {unit.unitNumber}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-[#94A3B8] animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-8 h-8 text-[#CBD5E1] mx-auto mb-2" />
            <p className="text-sm text-[#94A3B8]">No notes yet</p>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className={cn(
                'p-3 rounded-lg border',
                note.isResolved
                  ? 'bg-[#F8FAFC] border-[#E2E8F0]'
                  : 'bg-white border-[#E2E8F0]'
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-medium uppercase',
                    note.noteType === 'query' && 'bg-[#FEF3C7] text-[#92400E]',
                    note.noteType === 'issue' && 'bg-[#FEE2E2] text-[#991B1B]',
                    note.noteType === 'general' && 'bg-[#F1F5F9] text-[#475569]'
                  )}
                >
                  {note.noteType}
                </span>
                {note.isResolved ? (
                  <span className="flex items-center gap-1 text-[10px] text-[#047857]">
                    <Check className="w-3 h-3" />
                    Resolved
                  </span>
                ) : (
                  <button
                    onClick={() => handleResolveNote(note.id, true)}
                    className="text-[10px] text-[#0EA5E9] hover:underline"
                  >
                    Mark resolved
                  </button>
                )}
              </div>
              <p className={cn(
                'text-sm',
                note.isResolved ? 'text-[#94A3B8]' : 'text-[#0F172A]'
              )}>
                {note.content}
              </p>
              <div className="mt-2 text-[10px] text-[#94A3B8]">
                {note.createdBy?.name || 'Unknown'} ·{' '}
                {new Date(note.createdAt).toLocaleDateString('en-IE', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Note Form */}
      <div className="border-t border-[#E2E8F0] p-4 space-y-3">
        <div className="flex gap-2">
          {(['general', 'query', 'issue'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setNewNoteType(type)}
              className={cn(
                'px-2 py-1 rounded text-[11px] font-medium capitalize transition-colors',
                newNoteType === type
                  ? type === 'query'
                    ? 'bg-[#FEF3C7] text-[#92400E]'
                    : type === 'issue'
                    ? 'bg-[#FEE2E2] text-[#991B1B]'
                    : 'bg-[#0F172A] text-white'
                  : 'bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]'
              )}
            >
              {type}
            </button>
          ))}
        </div>
        <textarea
          value={newNoteContent}
          onChange={(e) => setNewNoteContent(e.target.value)}
          placeholder="Add a note..."
          className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#0EA5E9]"
          rows={3}
        />
        <button
          onClick={handleAddNote}
          disabled={!newNoteContent.trim() || isSubmitting}
          className={cn(
            'w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors',
            newNoteContent.trim() && !isSubmitting
              ? 'bg-[#0F172A] text-white hover:bg-[#1E293B]'
              : 'bg-[#F1F5F9] text-[#94A3B8] cursor-not-allowed'
          )}
        >
          {isSubmitting ? 'Adding...' : 'Add Note'}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Release Units Modal
// ============================================================================

interface ReleaseUnitsModalProps {
  units: PipelineUnit[];
  developmentId: string;
  onClose: () => void;
  onReleased: () => void;
}

function ReleaseUnitsModal({ units, developmentId, onClose, onReleased }: ReleaseUnitsModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const unreleasedUnits = units.filter((u) => !u.releaseDate);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === unreleasedUnits.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unreleasedUnits.map((u) => u.id)));
    }
  };

  const handleRelease = async () => {
    if (selectedIds.size === 0) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/pipeline/${developmentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitIds: Array.from(selectedIds) }),
      });

      if (response.ok) {
        onReleased();
        onClose();
      }
    } catch (error) {
      console.error('Failed to release units:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-lg font-semibold text-[#0F172A]">Release Units</h2>
          <button
            onClick={onClose}
            className="p-2 text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {unreleasedUnits.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-[#94A3B8]">All units have been released.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-[#475569]">
                  {unreleasedUnits.length} unreleased unit{unreleasedUnits.length !== 1 ? 's' : ''}
                </p>
                <button
                  onClick={selectAll}
                  className="text-sm text-[#0EA5E9] hover:underline"
                >
                  {selectedIds.size === unreleasedUnits.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="space-y-2">
                {unreleasedUnits.map((unit) => (
                  <button
                    key={unit.id}
                    onClick={() => toggleSelect(unit.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left',
                      selectedIds.has(unit.id)
                        ? 'border-[#0EA5E9] bg-[#F0F9FF]'
                        : 'border-[#E2E8F0] hover:bg-[#F8FAFC]'
                    )}
                  >
                    <div
                      className={cn(
                        'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                        selectedIds.has(unit.id)
                          ? 'border-[#0EA5E9] bg-[#0EA5E9]'
                          : 'border-[#CBD5E1]'
                      )}
                    >
                      {selectedIds.has(unit.id) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0F172A] truncate">
                        {unit.address}
                      </p>
                      <p className="text-xs text-[#94A3B8]">
                        Unit {unit.unitNumber} · {unit.houseTypeCode}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[#475569] hover:bg-[#F1F5F9] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleRelease}
            disabled={selectedIds.size === 0 || isSubmitting}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              selectedIds.size > 0 && !isSubmitting
                ? 'bg-[#0F172A] text-white hover:bg-[#1E293B]'
                : 'bg-[#F1F5F9] text-[#94A3B8] cursor-not-allowed'
            )}
          >
            {isSubmitting ? 'Releasing...' : `Release ${selectedIds.size} Unit${selectedIds.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function DevelopmentPipelinePage() {
  const params = useParams();
  const router = useRouter();
  const developmentId = params.developmentId as string;

  const [development, setDevelopment] = useState<Development | null>(null);
  const [units, setUnits] = useState<PipelineUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUnitForNotes, setSelectedUnitForNotes] = useState<PipelineUnit | null>(null);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, Set<string>>>(new Map());

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const url = searchQuery
        ? `/api/pipeline/${developmentId}?search=${encodeURIComponent(searchQuery)}`
        : `/api/pipeline/${developmentId}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch pipeline data');
      }
      const data = await response.json();
      setDevelopment(data.development);
      setUnits(data.units || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [developmentId, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle cell update with optimistic updates
  const handleCellUpdate = useCallback(
    async (unitId: string, field: string, value: string | null) => {
      // Optimistic update
      setUnits((prev) =>
        prev.map((u) => (u.id === unitId ? { ...u, [field]: value } : u))
      );

      // Mark as optimistic
      setOptimisticUpdates((prev) => {
        const newMap = new Map(prev);
        const fields = newMap.get(unitId) || new Set();
        fields.add(field);
        newMap.set(unitId, fields);
        return newMap;
      });

      try {
        const response = await fetch(`/api/pipeline/${developmentId}/${unitId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            field,  // Send camelCase field name directly - API expects camelCase
            value,
          }),
        });

        if (!response.ok) {
          // Revert on error
          await fetchData();
        }
      } catch (error) {
        // Revert on error
        await fetchData();
      } finally {
        // Clear optimistic flag
        setOptimisticUpdates((prev) => {
          const newMap = new Map(prev);
          const fields = newMap.get(unitId);
          if (fields) {
            fields.delete(field);
            if (fields.size === 0) {
              newMap.delete(unitId);
            }
          }
          return newMap;
        });
      }
    },
    [developmentId, fetchData]
  );

  // Filter to only show released units (have releaseDate)
  const releasedUnits = useMemo(() => {
    return units.filter((u) => u.releaseDate);
  }, [units]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-full bg-[#F8FAFC]">
        <div className="p-6 lg:p-8">
          <div className="max-w-full mx-auto">
            <div className="mb-6">
              <div className="h-6 w-32 bg-neutral-200 rounded animate-pulse mb-2" />
              <div className="h-4 w-48 bg-neutral-200 rounded animate-pulse" />
            </div>
            <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden">
              <div className="h-10 bg-[#F8FAFC] border-b border-[#E2E8F0]" />
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-9 border-b border-[#E2E8F0] animate-pulse bg-neutral-50" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-full bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-[#475569] text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-[#0EA5E9] rounded-lg hover:bg-[#0284C7] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F8FAFC]">
      <div className="p-4 lg:p-6">
        <div className="max-w-full mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/developer/pipeline')}
                className="p-2 text-[#94A3B8] hover:text-[#0F172A] hover:bg-white rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-semibold text-[#0F172A]">
                  {development?.name || 'Loading...'}
                </h1>
                <p className="text-xs text-[#94A3B8]">
                  {releasedUnits.length} released · {units.length} total units
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="pl-9 pr-4 py-2 text-sm border border-[#E2E8F0] rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]/20 focus:border-[#0EA5E9]"
                />
              </div>
              {/* Release Button */}
              <button
                onClick={() => setShowReleaseModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Release Units
              </button>
            </div>
          </div>

          {/* Empty State */}
          {releasedUnits.length === 0 ? (
            <div className="bg-white rounded-lg border border-[#E2E8F0] p-12 text-center">
              <p className="text-sm text-[#475569] mb-4">
                No units released yet.
              </p>
              <button
                onClick={() => setShowReleaseModal(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-[#0F172A] rounded-lg hover:bg-[#1E293B] transition-colors"
              >
                Release Units
              </button>
            </div>
          ) : (
            /* Pipeline Table */
            <div className="bg-white rounded-lg border border-[#E2E8F0] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: '1200px' }}>
                  {/* Header */}
                  <thead>
                    <tr className="bg-[#F8FAFC]">
                      {PIPELINE_COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          className={cn(
                            'h-10 px-3 text-left text-xs font-medium text-[#475569] uppercase tracking-wide border-b border-r border-[#E2E8F0] last:border-r-0',
                            col.frozen && 'sticky left-0 z-10 bg-[#F8FAFC] shadow-[2px_0_4px_rgba(0,0,0,0.03)]'
                          )}
                          style={{ width: col.width, minWidth: col.width }}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  {/* Body */}
                  <tbody>
                    {releasedUnits.map((unit, rowIndex) => {
                      const isOptimistic = optimisticUpdates.has(unit.id);

                      return (
                        <tr
                          key={unit.id}
                          className={cn(
                            'hover:bg-[#F8FAFC]/50',
                            rowIndex % 2 === 1 && 'bg-[#FAFBFC]'
                          )}
                        >
                          {PIPELINE_COLUMNS.map((col) => {
                            const cellKey = `${unit.id}-${col.key}`;
                            const isFieldOptimistic = optimisticUpdates.get(unit.id)?.has(col.key);

                            // Frozen Unit column
                            if (col.frozen) {
                              return (
                                <td
                                  key={cellKey}
                                  className="h-9 px-3 text-[11px] font-medium text-[#0F172A] truncate border-b border-r border-[#E2E8F0] sticky left-0 bg-white shadow-[2px_0_4px_rgba(0,0,0,0.03)] z-10"
                                  style={{ width: col.width, minWidth: col.width }}
                                  title={unit.address}
                                >
                                  {unit.address}
                                </td>
                              );
                            }

                            // Notes column
                            if (col.type === 'notes') {
                              return (
                                <td
                                  key={cellKey}
                                  className="h-9 border-b border-r border-[#E2E8F0] last:border-r-0"
                                  style={{ width: col.width, minWidth: col.width }}
                                >
                                  <NotesCell
                                    unit={unit}
                                    onClick={() => setSelectedUnitForNotes(unit)}
                                  />
                                </td>
                              );
                            }

                            // Date columns
                            if (col.type === 'date') {
                              const value = unit[col.key as keyof PipelineUnit] as string | null;
                              return (
                                <td
                                  key={cellKey}
                                  className="h-9 border-b border-r border-[#E2E8F0] last:border-r-0"
                                  style={{ width: col.width, minWidth: col.width }}
                                >
                                  <DateCell
                                    value={value}
                                    unitId={unit.id}
                                    field={col.key}
                                    onUpdate={handleCellUpdate}
                                    isOptimistic={isFieldOptimistic}
                                  />
                                </td>
                              );
                            }

                            // Text columns (purchaser name)
                            if (col.type === 'text' && col.editable) {
                              const value = unit[col.key as keyof PipelineUnit] as string | null;
                              return (
                                <td
                                  key={cellKey}
                                  className="h-9 border-b border-r border-[#E2E8F0] last:border-r-0"
                                  style={{ width: col.width, minWidth: col.width }}
                                >
                                  <TextCell
                                    value={value}
                                    unitId={unit.id}
                                    field={col.key}
                                    onUpdate={handleCellUpdate}
                                    isOptimistic={isFieldOptimistic}
                                  />
                                </td>
                              );
                            }

                            return null;
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notes Panel */}
      {selectedUnitForNotes && (
        <NotesPanel
          unit={selectedUnitForNotes}
          developmentId={developmentId}
          onClose={() => setSelectedUnitForNotes(null)}
          onNotesUpdated={fetchData}
        />
      )}

      {/* Release Units Modal */}
      {showReleaseModal && (
        <ReleaseUnitsModal
          units={units}
          developmentId={developmentId}
          onClose={() => setShowReleaseModal(false)}
          onReleased={fetchData}
        />
      )}
    </div>
  );
}
