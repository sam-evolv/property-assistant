'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  AlertCircle,
  MessageSquare,
  Plus,
  X,
  Check,
  Search,
  Loader2,
  ChevronDown,
  Calendar,
  Users,
  Home,
  CheckCircle2,
  Clock,
  Filter,
  MoreHorizontal,
  Sparkles,
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
  createdBy: { id: string; email: string } | null;
  resolvedBy: { id: string; email: string } | null;
}

// ============================================================================
// Pipeline Column Configuration
// ============================================================================

const PIPELINE_COLUMNS = [
  { key: 'address', label: 'Unit', width: 160, frozen: true, type: 'text' as const },
  { key: 'purchaserName', label: 'Purchaser', width: 160, type: 'text' as const, editable: true },
  { key: 'releaseDate', label: 'Released', width: 90, type: 'date' as const, editable: true, stage: 1 },
  { key: 'saleAgreedDate', label: 'Sale Agreed', width: 100, type: 'date' as const, editable: true, stage: 2 },
  { key: 'depositDate', label: 'Deposit', width: 90, type: 'date' as const, editable: true, stage: 3 },
  { key: 'contractsIssuedDate', label: 'Contracts Out', width: 110, type: 'date' as const, editable: true, stage: 4 },
  { key: 'notes', label: '', width: 50, type: 'notes' as const },
  { key: 'signedContractsDate', label: 'Signed In', width: 95, type: 'date' as const, editable: true, stage: 5 },
  { key: 'counterSignedDate', label: 'Counter Sign', width: 105, type: 'date' as const, editable: true, stage: 6 },
  { key: 'kitchenDate', label: 'Kitchen', width: 85, type: 'date' as const, editable: true, stage: 7 },
  { key: 'snagDate', label: 'Snag', width: 80, type: 'date' as const, editable: true, stage: 8 },
  { key: 'drawdownDate', label: 'Drawdown', width: 95, type: 'date' as const, editable: true, stage: 9 },
  { key: 'handoverDate', label: 'Handover', width: 90, type: 'date' as const, editable: true, stage: 10 },
] as const;

const DATE_FIELDS = PIPELINE_COLUMNS.filter(c => c.type === 'date').map(c => c.key);
const TOTAL_STAGES = DATE_FIELDS.length;

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

function getCompletedStages(unit: PipelineUnit): number {
  let count = 0;
  if (unit.releaseDate) count++;
  if (unit.saleAgreedDate) count++;
  if (unit.depositDate) count++;
  if (unit.contractsIssuedDate) count++;
  if (unit.signedContractsDate) count++;
  if (unit.counterSignedDate) count++;
  if (unit.kitchenDate) count++;
  if (unit.snagDate) count++;
  if (unit.drawdownDate) count++;
  if (unit.handoverDate) count++;
  return count;
}

function getStageStatus(unit: PipelineUnit): 'complete' | 'in-progress' | 'not-started' {
  if (unit.handoverDate) return 'complete';
  if (unit.releaseDate) return 'in-progress';
  return 'not-started';
}

// ============================================================================
// Date Cell Component - Premium Design
// ============================================================================

interface DateCellProps {
  value: string | null;
  unitId: string;
  field: string;
  onUpdate: (unitId: string, field: string, value: string | null) => Promise<void>;
  isOptimistic?: boolean;
  isFirstDate?: boolean;
}

function DateCell({ value, unitId, field, onUpdate, isOptimistic, isFirstDate }: DateCellProps) {
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

  const handleClear = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
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
      <div className="relative flex items-center h-full px-1">
        <input
          ref={inputRef}
          type="date"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="w-full h-7 px-2 text-xs bg-white border border-gold-400 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-gold-400/30 focus:border-gold-500"
          disabled={isSaving}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 p-0.5 text-grey-400 hover:text-red-500 transition-colors"
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
        'group w-full h-full flex items-center justify-center text-xs font-medium transition-all duration-150',
        value
          ? 'bg-emerald-50/80 text-emerald-700 hover:bg-emerald-100'
          : 'text-grey-300 hover:bg-grey-50 hover:text-grey-400',
        isOptimistic && 'animate-pulse',
        isSaving && 'opacity-50'
      )}
    >
      {value ? (
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 opacity-60" />
          {formatDate(value)}
        </span>
      ) : (
        <span className="opacity-0 group-hover:opacity-100 transition-opacity">
          <Plus className="w-3.5 h-3.5" />
        </span>
      )}
    </button>
  );
}

// ============================================================================
// Text Cell Component - Premium Design
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
      <div className="px-1 h-full flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="w-full h-7 px-2 text-xs bg-white border border-gold-400 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-gold-400/30 focus:border-gold-500"
          disabled={isSaving}
          placeholder="Enter name..."
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'group w-full h-full px-3 flex items-center text-xs text-left transition-colors hover:bg-grey-50',
        value ? 'text-grey-900 font-medium' : 'text-grey-300',
        isOptimistic && 'animate-pulse'
      )}
      title={value || undefined}
    >
      <span className="truncate">
        {value || <span className="opacity-0 group-hover:opacity-100">Add name...</span>}
      </span>
    </button>
  );
}

// ============================================================================
// Notes Cell Component - Premium Design
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
        'w-full h-full flex items-center justify-center transition-colors',
        hasUnresolved ? 'hover:bg-red-50' : 'hover:bg-grey-50'
      )}
      title={hasUnresolved ? `${unit.unresolvedNotesCount} unresolved` : hasNotes ? `${unit.notesCount} notes` : 'Add note'}
    >
      {hasUnresolved ? (
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold shadow-sm">
          {unit.unresolvedNotesCount}
        </span>
      ) : hasNotes ? (
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-grey-100 text-grey-500 text-[10px] font-medium">
          {unit.notesCount}
        </span>
      ) : (
        <MessageSquare className="w-3.5 h-3.5 text-grey-200 hover:text-grey-400 transition-colors" />
      )}
    </button>
  );
}

// ============================================================================
// Progress Bar Component
// ============================================================================

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const percentage = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-grey-100 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            percentage === 100 ? "bg-emerald-500" : "bg-gold-500"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-[10px] font-medium text-grey-500 tabular-nums">
        {completed}/{total}
      </span>
    </div>
  );
}

// ============================================================================
// Stats Cards Component
// ============================================================================

function StatsCards({ units }: { units: PipelineUnit[] }) {
  const released = units.filter(u => u.releaseDate).length;
  const inProgress = units.filter(u => u.releaseDate && !u.handoverDate).length;
  const completed = units.filter(u => u.handoverDate).length;
  const unreleased = units.filter(u => !u.releaseDate).length;

  const stats = [
    { label: 'Released', value: released, color: 'bg-blue-500', icon: Home },
    { label: 'In Progress', value: inProgress, color: 'bg-amber-500', icon: Clock },
    { label: 'Completed', value: completed, color: 'bg-emerald-500', icon: CheckCircle2 },
    { label: 'Unreleased', value: unreleased, color: 'bg-grey-300', icon: Users },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-white rounded-xl border border-grey-100 p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", stat.color)}>
              <stat.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-grey-900">{stat.value}</p>
              <p className="text-xs text-grey-500">{stat.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Notes Panel Component - Premium Design
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function fetchNotes() {
      try {
        const response = await fetch(`/api/pipeline/${developmentId}/${unit.id}/notes`);
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
      const response = await fetch(`/api/pipeline/${developmentId}/${unit.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNoteContent.trim(), noteType: newNoteType }),
      });
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

  const handleResolveNote = async (noteId: string, resolved: boolean) => {
    try {
      const response = await fetch(`/api/pipeline/${developmentId}/${unit.id}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId, resolved }),
      });
      if (response.ok) {
        const data = await response.json();
        setNotes(notes.map((n) => (n.id === noteId ? data.note : n)));
        onNotesUpdated();
      }
    } catch (error) {
      console.error('Failed to update note:', error);
    }
  };

  const noteTypeConfig = {
    general: { bg: 'bg-grey-100', text: 'text-grey-700', label: 'Note' },
    query: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Query' },
    issue: { bg: 'bg-red-100', text: 'text-red-800', label: 'Issue' },
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-[420px] bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-grey-100 bg-grey-50/50">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-grey-900 truncate">{unit.address}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-grey-500">Unit {unit.unitNumber}</span>
                <span className="text-grey-300">·</span>
                <span className="text-xs text-grey-500">{unit.houseTypeCode}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-grey-400 hover:text-grey-600 hover:bg-grey-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress */}
          <div className="px-5 pb-4">
            <ProgressBar completed={getCompletedStages(unit)} total={TOTAL_STAGES} />
          </div>
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-grey-300 animate-spin" />
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-grey-100 flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-6 h-6 text-grey-400" />
              </div>
              <p className="text-sm font-medium text-grey-600">No notes yet</p>
              <p className="text-xs text-grey-400 mt-1">Add a note to track queries or issues</p>
            </div>
          ) : (
            notes.map((note) => {
              const config = noteTypeConfig[note.noteType as keyof typeof noteTypeConfig] || noteTypeConfig.general;
              return (
                <div
                  key={note.id}
                  className={cn(
                    'p-4 rounded-xl border transition-all',
                    note.isResolved
                      ? 'bg-grey-50/50 border-grey-100 opacity-60'
                      : 'bg-white border-grey-200 shadow-sm hover:shadow-md'
                  )}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide', config.bg, config.text)}>
                      {config.label}
                    </span>
                    {note.isResolved ? (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                        <Check className="w-3 h-3" />
                        Resolved
                      </span>
                    ) : (
                      <button
                        onClick={() => handleResolveNote(note.id, true)}
                        className="text-[10px] font-medium text-gold-600 hover:text-gold-700 transition-colors"
                      >
                        Mark resolved
                      </button>
                    )}
                  </div>
                  <p className={cn('text-sm leading-relaxed', note.isResolved ? 'text-grey-500' : 'text-grey-800')}>
                    {note.content}
                  </p>
                  <div className="mt-3 text-[10px] text-grey-400">
                    {note.createdBy?.email || 'Unknown'} · {new Date(note.createdAt).toLocaleDateString('en-IE', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Add Note Form */}
        <div className="flex-shrink-0 border-t border-grey-100 p-5 bg-grey-50/50">
          <div className="flex gap-1.5 mb-3">
            {(['general', 'query', 'issue'] as const).map((type) => {
              const config = noteTypeConfig[type];
              return (
                <button
                  key={type}
                  onClick={() => setNewNoteType(type)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    newNoteType === type
                      ? cn(config.bg, config.text, 'shadow-sm')
                      : 'text-grey-500 hover:bg-grey-100'
                  )}
                >
                  {config.label}
                </button>
              );
            })}
          </div>
          <textarea
            ref={textareaRef}
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            placeholder="Write a note..."
            className="w-full px-3 py-2.5 text-sm border border-grey-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-gold-400/30 focus:border-gold-400 bg-white"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.metaKey) {
                handleAddNote();
              }
            }}
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-[10px] text-grey-400">⌘ + Enter to send</span>
            <button
              onClick={handleAddNote}
              disabled={!newNoteContent.trim() || isSubmitting}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-lg transition-all',
                newNoteContent.trim() && !isSubmitting
                  ? 'bg-grey-900 text-white hover:bg-grey-800 shadow-sm'
                  : 'bg-grey-100 text-grey-400 cursor-not-allowed'
              )}
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Note'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Release Units Modal - Premium Design
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
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-grey-100">
            <div>
              <h2 className="text-lg font-semibold text-grey-900">Release Units</h2>
              <p className="text-sm text-grey-500 mt-0.5">Select units to add to the pipeline</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-grey-400 hover:text-grey-600 hover:bg-grey-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {unreleasedUnits.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <p className="text-sm font-medium text-grey-600">All units released</p>
                <p className="text-xs text-grey-400 mt-1">Every unit has been added to the pipeline</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-grey-600">
                    {unreleasedUnits.length} unit{unreleasedUnits.length !== 1 ? 's' : ''} available
                  </p>
                  <button onClick={selectAll} className="text-sm font-medium text-gold-600 hover:text-gold-700 transition-colors">
                    {selectedIds.size === unreleasedUnits.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div className="space-y-2">
                  {unreleasedUnits.map((unit) => (
                    <button
                      key={unit.id}
                      onClick={() => toggleSelect(unit.id)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                        selectedIds.has(unit.id)
                          ? 'border-gold-400 bg-gold-50/50'
                          : 'border-grey-100 hover:border-grey-200 hover:bg-grey-50'
                      )}
                    >
                      <div
                        className={cn(
                          'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all',
                          selectedIds.has(unit.id)
                            ? 'border-gold-500 bg-gold-500'
                            : 'border-grey-300'
                        )}
                      >
                        {selectedIds.has(unit.id) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-grey-900 truncate">{unit.address}</p>
                        <p className="text-xs text-grey-500">
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
          {unreleasedUnits.length > 0 && (
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-grey-100 bg-grey-50/50">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-grey-600 hover:bg-grey-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRelease}
                disabled={selectedIds.size === 0 || isSubmitting}
                className={cn(
                  'px-5 py-2 text-sm font-medium rounded-lg transition-all',
                  selectedIds.size > 0 && !isSubmitting
                    ? 'bg-grey-900 text-white hover:bg-grey-800 shadow-sm'
                    : 'bg-grey-100 text-grey-400 cursor-not-allowed'
                )}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  `Release ${selectedIds.size || ''} Unit${selectedIds.size !== 1 ? 's' : ''}`
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
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
  const [viewMode, setViewMode] = useState<'all' | 'released'>('released');
  const tableRef = useRef<HTMLDivElement>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const url = searchQuery
        ? `/api/pipeline/${developmentId}?search=${encodeURIComponent(searchQuery)}`
        : `/api/pipeline/${developmentId}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch pipeline data');
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
      setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, [field]: value } : u)));
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
          body: JSON.stringify({ field, value }),
        });
        if (!response.ok) await fetchData();
      } catch {
        await fetchData();
      } finally {
        setOptimisticUpdates((prev) => {
          const newMap = new Map(prev);
          const fields = newMap.get(unitId);
          if (fields) {
            fields.delete(field);
            if (fields.size === 0) newMap.delete(unitId);
          }
          return newMap;
        });
      }
    },
    [developmentId, fetchData]
  );

  // Filter units based on view mode
  const displayedUnits = useMemo(() => {
    if (viewMode === 'released') {
      return units.filter((u) => u.releaseDate);
    }
    return units;
  }, [units, viewMode]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-full bg-gradient-to-br from-grey-50 to-white">
        <div className="p-6 lg:p-8">
          <div className="max-w-full">
            <div className="mb-8">
              <div className="h-6 w-48 bg-grey-200 rounded-lg animate-pulse mb-3" />
              <div className="h-4 w-32 bg-grey-100 rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-white rounded-xl border border-grey-100 animate-pulse" />
              ))}
            </div>
            <div className="bg-white rounded-xl border border-grey-100 overflow-hidden">
              <div className="h-12 bg-grey-50 border-b border-grey-100" />
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-11 border-b border-grey-50 animate-pulse bg-white" />
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
      <div className="min-h-full bg-gradient-to-br from-grey-50 to-white flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-grey-600 text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium text-white bg-grey-900 rounded-lg hover:bg-grey-800 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-grey-50 to-white">
      <div className="p-5 lg:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/developer/pipeline')}
              className="p-2 text-grey-400 hover:text-grey-600 hover:bg-white rounded-lg transition-all shadow-sm border border-grey-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-grey-900">{development?.name}</h1>
              <p className="text-sm text-grey-500">{development?.address}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-grey-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search units..."
                className="pl-9 pr-4 py-2 text-sm border border-grey-200 rounded-xl w-56 focus:outline-none focus:ring-2 focus:ring-gold-400/30 focus:border-gold-400 bg-white shadow-sm"
              />
            </div>

            {/* View Toggle */}
            <div className="flex items-center bg-grey-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('released')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                  viewMode === 'released' ? 'bg-white text-grey-900 shadow-sm' : 'text-grey-500 hover:text-grey-700'
                )}
              >
                Released
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                  viewMode === 'all' ? 'bg-white text-grey-900 shadow-sm' : 'text-grey-500 hover:text-grey-700'
                )}
              >
                All Units
              </button>
            </div>

            {/* Release Button */}
            <button
              onClick={() => setShowReleaseModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-grey-900 rounded-xl hover:bg-grey-800 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Release Units
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6">
          <StatsCards units={units} />
        </div>

        {/* Empty State */}
        {displayedUnits.length === 0 ? (
          <div className="bg-white rounded-xl border border-grey-100 p-16 text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-grey-100 flex items-center justify-center mx-auto mb-4">
              <Home className="w-8 h-8 text-grey-400" />
            </div>
            <p className="text-base font-medium text-grey-700 mb-2">
              {viewMode === 'released' ? 'No units released yet' : 'No units found'}
            </p>
            <p className="text-sm text-grey-500 mb-6">
              {viewMode === 'released' ? 'Release units to start tracking their progress through the pipeline' : 'Try adjusting your search'}
            </p>
            {viewMode === 'released' && (
              <button
                onClick={() => setShowReleaseModal(true)}
                className="px-5 py-2.5 text-sm font-medium text-white bg-grey-900 rounded-xl hover:bg-grey-800 transition-all shadow-sm"
              >
                Release Units
              </button>
            )}
          </div>
        ) : (
          /* Pipeline Table */
          <div className="bg-white rounded-xl border border-grey-100 shadow-sm overflow-hidden">
            <div ref={tableRef} className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: '1400px' }}>
                <thead>
                  <tr className="bg-grey-50/80">
                    {PIPELINE_COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className={cn(
                          'h-11 px-3 text-left text-[11px] font-semibold text-grey-500 uppercase tracking-wider border-b border-grey-100',
                          col.frozen && 'sticky left-0 z-20 bg-grey-50/80 shadow-[2px_0_8px_rgba(0,0,0,0.04)]'
                        )}
                        style={{ width: col.width, minWidth: col.width }}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedUnits.map((unit, rowIndex) => {
                    const status = getStageStatus(unit);

                    return (
                      <tr
                        key={unit.id}
                        className={cn(
                          'group transition-colors',
                          rowIndex % 2 === 0 ? 'bg-white' : 'bg-grey-50/30',
                          'hover:bg-gold-50/30'
                        )}
                      >
                        {PIPELINE_COLUMNS.map((col) => {
                          const isFieldOptimistic = optimisticUpdates.get(unit.id)?.has(col.key);

                          if (col.frozen) {
                            return (
                              <td
                                key={`${unit.id}-${col.key}`}
                                className="h-11 px-3 text-xs font-medium text-grey-900 border-b border-grey-50 sticky left-0 z-10 bg-inherit shadow-[2px_0_8px_rgba(0,0,0,0.04)] group-hover:bg-gold-50/30"
                                style={{ width: col.width, minWidth: col.width }}
                              >
                                <div className="flex items-center gap-2 truncate" title={unit.address}>
                                  <div className={cn(
                                    'w-2 h-2 rounded-full flex-shrink-0',
                                    status === 'complete' && 'bg-emerald-500',
                                    status === 'in-progress' && 'bg-amber-500',
                                    status === 'not-started' && 'bg-grey-300'
                                  )} />
                                  <span className="truncate">{unit.address}</span>
                                </div>
                              </td>
                            );
                          }

                          if (col.type === 'notes') {
                            return (
                              <td
                                key={`${unit.id}-${col.key}`}
                                className="h-11 border-b border-grey-50"
                                style={{ width: col.width, minWidth: col.width }}
                              >
                                <NotesCell unit={unit} onClick={() => setSelectedUnitForNotes(unit)} />
                              </td>
                            );
                          }

                          if (col.type === 'date') {
                            const value = unit[col.key as keyof PipelineUnit] as string | null;
                            return (
                              <td
                                key={`${unit.id}-${col.key}`}
                                className="h-11 border-b border-grey-50"
                                style={{ width: col.width, minWidth: col.width }}
                              >
                                <DateCell
                                  value={value}
                                  unitId={unit.id}
                                  field={col.key}
                                  onUpdate={handleCellUpdate}
                                  isOptimistic={isFieldOptimistic}
                                  isFirstDate={col.key === 'releaseDate'}
                                />
                              </td>
                            );
                          }

                          if (col.type === 'text' && col.editable) {
                            const value = unit[col.key as keyof PipelineUnit] as string | null;
                            return (
                              <td
                                key={`${unit.id}-${col.key}`}
                                className="h-11 border-b border-grey-50"
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

            {/* Table Footer */}
            <div className="px-4 py-3 border-t border-grey-100 bg-grey-50/50 flex items-center justify-between">
              <p className="text-xs text-grey-500">
                {displayedUnits.length} unit{displayedUnits.length !== 1 ? 's' : ''} · Click empty date cells to set today's date
              </p>
              <div className="flex items-center gap-1 text-xs text-grey-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Powered by OpenHouse AI</span>
              </div>
            </div>
          </div>
        )}
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
