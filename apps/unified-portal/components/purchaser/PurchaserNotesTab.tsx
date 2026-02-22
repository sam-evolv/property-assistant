'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  StickyNote, Plus, Trash2, Pin, PinOff, X, Wrench, Shield, Zap,
  Lock, Flower2, ChevronDown, AlertCircle, Loader2,
} from 'lucide-react';
import { useHomeNotes, type HomeNote, type NoteCategory } from '@/hooks/useHomeNotes';
import { getEffectiveToken } from '@/lib/purchaserSession';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PurchaserNotesTabProps {
  unitUid: string;
  isDarkMode: boolean;
  selectedLanguage: string;
  token?: string;
}

// ─── Category Config ────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<NoteCategory, {
  label: string;
  Icon: React.ElementType;
  lightBg: string;
  lightText: string;
  lightBorder: string;
  darkBg: string;
  darkText: string;
  darkBorder: string;
  dotColor: string;
}> = {
  maintenance: {
    label: 'Maintenance',
    Icon: Wrench,
    lightBg: 'bg-amber-50',    lightText: 'text-amber-700',    lightBorder: 'border-amber-200',
    darkBg: 'bg-amber-950/30', darkText: 'text-amber-400',     darkBorder: 'border-amber-800/40',
    dotColor: '#F59E0B',
  },
  warranty: {
    label: 'Warranty',
    Icon: Shield,
    lightBg: 'bg-blue-50',     lightText: 'text-blue-700',     lightBorder: 'border-blue-200',
    darkBg: 'bg-blue-950/30',  darkText: 'text-blue-400',      darkBorder: 'border-blue-800/40',
    dotColor: '#3B82F6',
  },
  utility: {
    label: 'Utility',
    Icon: Zap,
    lightBg: 'bg-emerald-50',  lightText: 'text-emerald-700',  lightBorder: 'border-emerald-200',
    darkBg: 'bg-emerald-950/30', darkText: 'text-emerald-400', darkBorder: 'border-emerald-800/40',
    dotColor: '#10B981',
  },
  appliance: {
    label: 'Appliance',
    Icon: Zap,
    lightBg: 'bg-violet-50',   lightText: 'text-violet-700',   lightBorder: 'border-violet-200',
    darkBg: 'bg-violet-950/30', darkText: 'text-violet-400',   darkBorder: 'border-violet-800/40',
    dotColor: '#8B5CF6',
  },
  garden: {
    label: 'Garden',
    Icon: Flower2,
    lightBg: 'bg-green-50',    lightText: 'text-green-700',    lightBorder: 'border-green-200',
    darkBg: 'bg-green-950/30', darkText: 'text-green-400',     darkBorder: 'border-green-800/40',
    dotColor: '#22C55E',
  },
  security: {
    label: 'Security',
    Icon: Lock,
    lightBg: 'bg-red-50',      lightText: 'text-red-700',      lightBorder: 'border-red-200',
    darkBg: 'bg-red-950/30',   darkText: 'text-red-400',       darkBorder: 'border-red-800/40',
    dotColor: '#EF4444',
  },
  general: {
    label: 'General',
    Icon: StickyNote,
    lightBg: 'bg-gray-50',     lightText: 'text-gray-600',     lightBorder: 'border-gray-200',
    darkBg: 'bg-gray-800/30',  darkText: 'text-gray-400',      darkBorder: 'border-gray-700/40',
    dotColor: '#6B7280',
  },
};

const FILTER_OPTIONS: { value: NoteCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'utility', label: 'Utility' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'garden', label: 'Garden' },
  { value: 'security', label: 'Security' },
  { value: 'general', label: 'General' },
];

// ─── Translations ───────────────────────────────────────────────────────────

const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    header: 'My Home Notes',
    subtitle: 'Keep track of important details about your home',
    empty: 'No Notes Yet',
    emptyDesc: 'Tap the button below to add your first note about your home.',
    addButton: 'Add Note',
    addTitle: 'New Note',
    placeholder: 'e.g. Boiler serviced on 15 Jan, warranty expires Dec 2026...',
    cancel: 'Cancel',
    save: 'Save Note',
    saving: 'Saving...',
    deleteConfirm: 'Delete this note?',
    deleteYes: 'Delete',
    deleteNo: 'Keep',
    pinned: 'Pinned',
    filterAll: 'All Notes',
    charCount: 'characters remaining',
    error: 'Something went wrong',
  },
  pl: {
    header: 'Moje Notatki',
    subtitle: 'Śledź ważne szczegóły dotyczące domu',
    empty: 'Brak Notatek',
    emptyDesc: 'Naciśnij przycisk poniżej, aby dodać pierwszą notatkę.',
    addButton: 'Dodaj Notatkę',
    addTitle: 'Nowa Notatka',
    placeholder: 'np. Kocioł serwisowany 15 stycznia, gwarancja wygasa grudzień 2026...',
    cancel: 'Anuluj',
    save: 'Zapisz',
    saving: 'Zapisywanie...',
    deleteConfirm: 'Usunąć tę notatkę?',
    deleteYes: 'Usuń',
    deleteNo: 'Zachowaj',
    pinned: 'Przypięte',
    filterAll: 'Wszystkie',
    charCount: 'pozostałych znaków',
    error: 'Coś poszło nie tak',
  },
  ga: {
    header: 'Mo Nótaí Baile',
    subtitle: 'Coinnigh súil ar shonraí tábhachtacha faoi do theach',
    empty: 'Gan Nótaí Fós',
    emptyDesc: 'Brúigh an cnaipe thíos chun do chéad nóta a chur leis.',
    addButton: 'Cuir Nóta Leis',
    addTitle: 'Nóta Nua',
    placeholder: 'm.sh. Coire seirbhísithe an 15 Eanáir...',
    cancel: 'Cealaigh',
    save: 'Sábháil',
    saving: 'Ag Sábháil...',
    deleteConfirm: 'An nóta seo a scriosadh?',
    deleteYes: 'Scrios',
    deleteNo: 'Coinnigh',
    pinned: 'Pinn',
    filterAll: 'Gach Nóta',
    charCount: 'carachtair fágtha',
    error: 'Chuaigh rud éigin mícheart',
  },
};

function t(lang: string, key: string): string {
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

const MAX_NOTE_LENGTH = 2000;

// ─── Component ──────────────────────────────────────────────────────────────

export default function PurchaserNotesTab({
  unitUid,
  isDarkMode,
  selectedLanguage,
  token,
}: PurchaserNotesTabProps) {
  const {
    notes,
    isLoading,
    error,
    addNote,
    deleteNote,
    togglePin,
    isAdding,
    isDeleting,
  } = useHomeNotes({ unitUid });

  const [showAddForm, setShowAddForm] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [filter, setFilter] = useState<NoteCategory | 'all'>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  // Close filter dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilterDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Auto-focus textarea when form opens
  useEffect(() => {
    if (showAddForm && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [showAddForm]);

  // Filter notes
  const filteredNotes = filter === 'all'
    ? notes
    : notes.filter(n => n.category === filter);

  // Category counts for filter badges
  const categoryCounts = notes.reduce<Record<string, number>>((acc, n) => {
    acc[n.category] = (acc[n.category] || 0) + 1;
    return acc;
  }, {});

  // ─── Handlers ──────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!noteContent.trim() || isAdding) return;
    const result = await addNote(noteContent.trim());
    if (result) {
      setNoteContent('');
      setShowAddForm(false);
    }
  }, [noteContent, isAdding, addNote]);

  const handleDelete = useCallback(async (noteId: string) => {
    await deleteNote(noteId);
    setDeleteConfirmId(null);
  }, [deleteNote]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  // ─── Shared Styles ─────────────────────────────────────────────────

  const cardBg = isDarkMode ? 'bg-[#161a22]' : 'bg-white';
  const cardBorder = isDarkMode ? 'border-[#1e2531]' : 'border-gray-100';
  const textPrimary = isDarkMode ? 'text-[#eef2f8]' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-[#9ca8bc]' : 'text-gray-500';
  const textTertiary = isDarkMode ? 'text-[#778199]' : 'text-gray-400';
  const surfaceBg = isDarkMode ? 'bg-[#0f1115]' : 'bg-[#f7f7f8]';
  const inputBg = isDarkMode ? 'bg-[#12151b]' : 'bg-white';
  const inputBorder = isDarkMode ? 'border-[#1e2531]' : 'border-gray-200';

  // ─── Loading State ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className={`h-full flex flex-col ${surfaceBg}`}>
        {/* Header skeleton */}
        <div className="px-5 pt-6 pb-4">
          <div className={`h-7 w-40 rounded-lg ${isDarkMode ? 'bg-[#1e2531]' : 'bg-gray-200'} animate-pulse`} />
          <div className={`h-4 w-64 rounded mt-2 ${isDarkMode ? 'bg-[#161a22]' : 'bg-gray-100'} animate-pulse`} />
        </div>
        {/* Card skeletons */}
        <div className="flex-1 overflow-y-auto px-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className={`rounded-xl border p-4 ${cardBg} ${cardBorder} animate-pulse`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className={`h-4 w-20 rounded ${isDarkMode ? 'bg-[#1e2531]' : 'bg-gray-200'}`} />
              <div className={`h-4 w-full rounded mt-3 ${isDarkMode ? 'bg-[#1e2531]' : 'bg-gray-100'}`} />
              <div className={`h-4 w-3/4 rounded mt-2 ${isDarkMode ? 'bg-[#1e2531]' : 'bg-gray-100'}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Error State ───────────────────────────────────────────────────

  if (error && notes.length === 0) {
    return (
      <div className={`h-full flex items-center justify-center ${surfaceBg}`}>
        <div className="text-center px-8">
          <div className={`w-16 h-16 rounded-2xl ${isDarkMode ? 'bg-red-950/30' : 'bg-red-50'} flex items-center justify-center mx-auto mb-4`}>
            <AlertCircle className={`w-8 h-8 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`} />
          </div>
          <h3 className={`text-lg font-semibold ${textPrimary} mb-1`}>{t(selectedLanguage, 'error')}</h3>
          <p className={`text-sm ${textSecondary}`}>{error}</p>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className={`h-full flex flex-col ${surfaceBg} overflow-hidden`}>
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div
        className="px-5 pt-6 pb-3 flex-shrink-0"
        style={{ paddingTop: '24px', paddingBottom: '12px' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2
              className={`text-[22px] font-bold tracking-tight ${textPrimary}`}
              style={{ lineHeight: '28px', letterSpacing: '-0.02em' }}
            >
              {t(selectedLanguage, 'header')}
            </h2>
            <p
              className={`text-[13px] mt-1 ${textSecondary}`}
              style={{ lineHeight: '18px' }}
            >
              {t(selectedLanguage, 'subtitle')}
            </p>
          </div>
          {notes.length > 0 && (
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                isDarkMode ? 'bg-[#1e2531] text-[#9ca8bc]' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {notes.length}
            </span>
          )}
        </div>

        {/* ── Filter Row ──────────────────────────────────────────────── */}
        {notes.length > 0 && (
          <div className="mt-4 flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
            {FILTER_OPTIONS.map(opt => {
              const isActive = filter === opt.value;
              const count = opt.value === 'all' ? notes.length : (categoryCounts[opt.value] || 0);
              if (opt.value !== 'all' && count === 0) return null;

              return (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                    whitespace-nowrap transition-all duration-150 tap-effect
                    ${isActive
                      ? isDarkMode
                        ? 'bg-gold-900/40 text-gold-400 border border-gold-700/50'
                        : 'bg-gold-50 text-gold-700 border border-gold-200'
                      : isDarkMode
                        ? 'bg-[#161a22] text-[#778199] border border-[#1e2531] hover:bg-[#1e2531]'
                        : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                    }
                  `}
                  style={{ minHeight: '32px' }}
                >
                  {opt.value !== 'all' && (
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: CATEGORY_CONFIG[opt.value as NoteCategory]?.dotColor }}
                    />
                  )}
                  <span>{opt.label}</span>
                  <span className={`text-[10px] ${isActive ? 'opacity-80' : 'opacity-50'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Notes List ────────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto px-4 pb-32"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {filteredNotes.length === 0 && !isLoading ? (
          /* ── Empty State ──────────────────────────────────────────── */
          <div className="flex flex-col items-center justify-center py-20 px-8">
            <div
              className={`w-20 h-20 rounded-[20px] flex items-center justify-center mb-5 ${
                isDarkMode ? 'bg-[#161a22]' : 'bg-gray-50'
              }`}
              style={{
                boxShadow: isDarkMode
                  ? '0 0 0 1px rgba(30,37,49,1), 0 4px 12px rgba(0,0,0,0.3)'
                  : '0 0 0 1px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)',
              }}
            >
              <StickyNote
                className={`w-9 h-9 ${isDarkMode ? 'text-[#778199]' : 'text-gray-300'}`}
                strokeWidth={1.5}
              />
            </div>
            <h3
              className={`text-lg font-semibold ${textPrimary} mb-1.5`}
              style={{ letterSpacing: '-0.01em' }}
            >
              {notes.length === 0 ? t(selectedLanguage, 'empty') : 'No matching notes'}
            </h3>
            <p className={`text-sm text-center max-w-[280px] ${textSecondary}`} style={{ lineHeight: '20px' }}>
              {notes.length === 0
                ? t(selectedLanguage, 'emptyDesc')
                : 'Try a different filter to see your notes.'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {filteredNotes.map((note, index) => (
              <NoteCard
                key={note.id}
                note={note}
                isDarkMode={isDarkMode}
                isDeleting={isDeleting === note.id}
                deleteConfirmId={deleteConfirmId}
                onDelete={() => setDeleteConfirmId(note.id)}
                onConfirmDelete={() => handleDelete(note.id)}
                onCancelDelete={() => setDeleteConfirmId(null)}
                onTogglePin={() => togglePin(note.id)}
                index={index}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Add Note FAB ──────────────────────────────────────────────── */}
      {!showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="fixed right-5 z-30 flex items-center gap-2 px-5 py-3
            rounded-full text-sm font-semibold text-white shadow-lg
            bg-gradient-to-r from-gold-500 to-gold-600
            hover:from-gold-600 hover:to-gold-700
            active:scale-95 transition-all duration-150 tap-effect"
          style={{
            bottom: 'calc(var(--mobile-tab-bar-h, 80px) + 16px)',
            boxShadow: '0 4px 20px rgba(212,175,55,0.35), 0 2px 8px rgba(0,0,0,0.15)',
          }}
          aria-label={t(selectedLanguage, 'addButton')}
        >
          <Plus className="w-5 h-5" strokeWidth={2.5} />
          <span>{t(selectedLanguage, 'addButton')}</span>
        </button>
      )}

      {/* ── Add Note Sheet ────────────────────────────────────────────── */}
      {showAddForm && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fadeIn"
            onClick={() => { setShowAddForm(false); setNoteContent(''); }}
          />

          {/* Bottom Sheet */}
          <div
            className={`fixed left-0 right-0 z-50 rounded-t-[20px] border-t ${
              isDarkMode ? 'bg-[#12151b] border-[#1e2531]' : 'bg-white border-gray-200'
            }`}
            style={{
              bottom: 0,
              maxHeight: '80vh',
              animation: 'noteSheetUp 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
              paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div
                className={`w-10 h-[5px] rounded-full ${
                  isDarkMode ? 'bg-[#2a3040]' : 'bg-gray-300'
                }`}
              />
            </div>

            {/* Title */}
            <div className="flex items-center justify-between px-5 py-3">
              <h3 className={`text-lg font-bold ${textPrimary}`} style={{ letterSpacing: '-0.01em' }}>
                {t(selectedLanguage, 'addTitle')}
              </h3>
              <button
                onClick={() => { setShowAddForm(false); setNoteContent(''); }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                  isDarkMode
                    ? 'bg-[#1e2531] text-[#9ca8bc] hover:bg-[#2a3040]'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Textarea */}
            <div className="px-5">
              <textarea
                ref={textareaRef}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value.slice(0, MAX_NOTE_LENGTH))}
                onKeyDown={handleKeyDown}
                placeholder={t(selectedLanguage, 'placeholder')}
                rows={4}
                className={`w-full rounded-xl border px-4 py-3 text-[15px] resize-none
                  transition-colors duration-150 ${inputBg} ${inputBorder} ${textPrimary}
                  placeholder:${textTertiary}
                  focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500/50`}
                style={{
                  lineHeight: '22px',
                  fontSize: '16px', // Prevents iOS zoom
                  WebkitAppearance: 'none',
                }}
              />
              <div className="flex items-center justify-between mt-2 mb-4">
                <p className={`text-xs ${textTertiary}`}>
                  {MAX_NOTE_LENGTH - noteContent.length} {t(selectedLanguage, 'charCount')}
                </p>
                {noteContent.length > MAX_NOTE_LENGTH * 0.9 && (
                  <p className="text-xs text-amber-500 font-medium">
                    {MAX_NOTE_LENGTH - noteContent.length} left
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 flex gap-3">
              <button
                onClick={() => { setShowAddForm(false); setNoteContent(''); }}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition tap-effect ${
                  isDarkMode
                    ? 'bg-[#1e2531] text-[#9ca8bc] hover:bg-[#2a3040]'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t(selectedLanguage, 'cancel')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={!noteContent.trim() || isAdding}
                className={`flex-[2] py-3 rounded-xl text-sm font-semibold text-white
                  transition-all tap-effect
                  bg-gradient-to-r from-gold-500 to-gold-600
                  hover:from-gold-600 hover:to-gold-700
                  disabled:opacity-40 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2`}
              >
                {isAdding ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t(selectedLanguage, 'saving')}</span>
                  </>
                ) : (
                  <span>{t(selectedLanguage, 'save')}</span>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── NoteCard Sub-Component ─────────────────────────────────────────────────

interface NoteCardProps {
  note: HomeNote;
  isDarkMode: boolean;
  isDeleting: boolean;
  deleteConfirmId: string | null;
  onDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onTogglePin: () => void;
  index: number;
}

function NoteCard({
  note,
  isDarkMode,
  isDeleting,
  deleteConfirmId,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  onTogglePin,
  index,
}: NoteCardProps) {
  const cat = CATEGORY_CONFIG[note.category] || CATEGORY_CONFIG.general;
  const CatIcon = cat.Icon;
  const isConfirming = deleteConfirmId === note.id;
  const isTemp = note.id.startsWith('temp_');

  const cardBg = isDarkMode ? 'bg-[#161a22]' : 'bg-white';
  const cardBorder = isDarkMode ? 'border-[#1e2531]' : 'border-gray-100';
  const textPrimary = isDarkMode ? 'text-[#eef2f8]' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-[#9ca8bc]' : 'text-gray-500';

  return (
    <div
      className={`
        relative rounded-xl border p-4 transition-all duration-200
        ${cardBg} ${cardBorder}
        ${isDeleting ? 'opacity-50 scale-[0.98]' : 'opacity-100'}
        ${isTemp ? 'opacity-70' : ''}
      `}
      style={{
        animation: `noteCardIn 300ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 50}ms both`,
        boxShadow: isDarkMode
          ? '0 1px 2px rgba(0,0,0,0.2)'
          : '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
      }}
    >
      {/* Top Row: Category Badge + Actions */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          {/* Category Badge */}
          <span
            className={`
              inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold
              border ${isDarkMode ? cat.darkBg : cat.lightBg}
              ${isDarkMode ? cat.darkText : cat.lightText}
              ${isDarkMode ? cat.darkBorder : cat.lightBorder}
            `}
            style={{ letterSpacing: '0.02em' }}
          >
            <CatIcon className="w-3 h-3" strokeWidth={2} />
            {cat.label}
          </span>

          {/* Pin indicator */}
          {note.pinned && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold
                ${isDarkMode ? 'bg-gold-900/30 text-gold-400' : 'bg-gold-50 text-gold-600'}
              `}
            >
              <Pin className="w-2.5 h-2.5" strokeWidth={2.5} />
              Pinned
            </span>
          )}
        </div>

        {/* Actions */}
        {!isTemp && (
          <div className="flex items-center gap-1">
            <button
              onClick={onTogglePin}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition tap-effect ${
                isDarkMode
                  ? 'text-[#778199] hover:bg-[#1e2531] hover:text-gold-400'
                  : 'text-gray-400 hover:bg-gray-100 hover:text-gold-600'
              }`}
              aria-label={note.pinned ? 'Unpin' : 'Pin'}
            >
              {note.pinned ? (
                <PinOff className="w-4 h-4" strokeWidth={2} />
              ) : (
                <Pin className="w-4 h-4" strokeWidth={2} />
              )}
            </button>
            <button
              onClick={onDelete}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition tap-effect ${
                isDarkMode
                  ? 'text-[#778199] hover:bg-red-950/30 hover:text-red-400'
                  : 'text-gray-400 hover:bg-red-50 hover:text-red-500'
              }`}
              aria-label="Delete"
            >
              <Trash2 className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        )}
      </div>

      {/* Note Content */}
      <p
        className={`text-[14px] leading-[21px] ${textPrimary} whitespace-pre-wrap break-words`}
        style={{ wordBreak: 'break-word' }}
      >
        {note.content}
      </p>

      {/* Timestamp */}
      <p className={`text-[11px] mt-3 ${textSecondary}`} style={{ letterSpacing: '0.01em' }}>
        {isTemp ? 'Saving...' : formatDate(note.created_at)}
      </p>

      {/* Delete Confirmation Overlay */}
      {isConfirming && (
        <div
          className={`absolute inset-0 rounded-xl flex items-center justify-center gap-3 z-10 ${
            isDarkMode ? 'bg-[#12151b]/95' : 'bg-white/95'
          }`}
          style={{ backdropFilter: 'blur(4px)' }}
        >
          <p className={`text-sm font-medium ${isDarkMode ? 'text-[#eef2f8]' : 'text-gray-900'} mr-2`}>
            Delete?
          </p>
          <button
            onClick={onConfirmDelete}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white
              bg-red-500 hover:bg-red-600 transition tap-effect
              disabled:opacity-50 flex items-center gap-1.5"
          >
            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Delete
          </button>
          <button
            onClick={onCancelDelete}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition tap-effect ${
              isDarkMode
                ? 'bg-[#1e2531] text-[#9ca8bc] hover:bg-[#2a3040]'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Keep
          </button>
        </div>
      )}
    </div>
  );
}
