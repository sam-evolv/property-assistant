'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getEffectiveToken } from '@/lib/purchaserSession';

// ─── Types ──────────────────────────────────────────────────────────────────

export type NoteCategory =
  | 'maintenance'
  | 'warranty'
  | 'utility'
  | 'appliance'
  | 'garden'
  | 'security'
  | 'general';

export interface HomeNote {
  id: string;
  content: string;
  category: NoteCategory;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

interface UseHomeNotesOptions {
  unitUid: string;
  enabled?: boolean;
}

interface UseHomeNotesReturn {
  notes: HomeNote[];
  isLoading: boolean;
  error: string | null;
  addNote: (content: string, pinned?: boolean) => Promise<HomeNote | null>;
  deleteNote: (noteId: string) => Promise<boolean>;
  togglePin: (noteId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  isAdding: boolean;
  isDeleting: string | null; // noteId being deleted
}

// ─── Offline Cache ──────────────────────────────────────────────────────────

const CACHE_KEY_PREFIX = 'home_notes_cache_';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedNotes(unitUid: string): HomeNote[] | null {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${unitUid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(`${CACHE_KEY_PREFIX}${unitUid}`);
      return null;
    }
    return parsed.notes;
  } catch {
    return null;
  }
}

function setCachedNotes(unitUid: string, notes: HomeNote[]): void {
  try {
    localStorage.setItem(
      `${CACHE_KEY_PREFIX}${unitUid}`,
      JSON.stringify({ notes, timestamp: Date.now() })
    );
  } catch {
    // Storage full or unavailable
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useHomeNotes({ unitUid, enabled = true }: UseHomeNotesOptions): UseHomeNotesReturn {
  const [notes, setNotes] = useState<HomeNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ─── Fetch Notes ────────────────────────────────────────────────────

  const fetchNotes = useCallback(async () => {
    if (!unitUid || !enabled) return;

    const token = getEffectiveToken(unitUid);

    // Try cache first for instant display
    const cached = getCachedNotes(unitUid);
    if (cached && isLoading) {
      setNotes(cached);
    }

    try {
      const res = await fetch(
        `/api/purchaser/notes?unitUid=${encodeURIComponent(unitUid)}&token=${encodeURIComponent(token)}`
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to fetch notes (${res.status})`);
      }

      const data = await res.json();
      if (mountedRef.current) {
        setNotes(data.notes || []);
        setCachedNotes(unitUid, data.notes || []);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        // If we have cached data, show it with a warning
        if (cached) {
          setNotes(cached);
          setError(null); // Don't show error if we have cache
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load notes');
        }
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [unitUid, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // ─── Add Note (Optimistic) ──────────────────────────────────────────

  const addNote = useCallback(async (content: string, pinned = false): Promise<HomeNote | null> => {
    if (!unitUid) return null;

    const token = getEffectiveToken(unitUid);
    setIsAdding(true);
    setError(null);

    // Optimistic: add a temporary note
    const tempId = `temp_${Date.now()}`;
    const optimistic: HomeNote = {
      id: tempId,
      content,
      category: 'general',
      pinned,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setNotes(prev => {
      const updated = pinned ? [optimistic, ...prev] : [...prev, optimistic];
      // Re-sort: pinned first, then by created_at desc
      return updated.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    });

    try {
      const res = await fetch('/api/purchaser/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, unitUid, content, pinned }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create note');
      }

      const data = await res.json();
      const newNote: HomeNote = data.note;

      // Replace optimistic note with real one
      if (mountedRef.current) {
        setNotes(prev => {
          const updated = prev.map(n => n.id === tempId ? newNote : n);
          return updated.sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
        });
        setCachedNotes(unitUid, notes);
      }

      return newNote;
    } catch (err) {
      // Rollback optimistic update
      if (mountedRef.current) {
        setNotes(prev => prev.filter(n => n.id !== tempId));
        setError(err instanceof Error ? err.message : 'Failed to add note');
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setIsAdding(false);
      }
    }
  }, [unitUid, notes]);

  // ─── Delete Note (Optimistic) ───────────────────────────────────────

  const deleteNote = useCallback(async (noteId: string): Promise<boolean> => {
    if (!unitUid) return false;

    const token = getEffectiveToken(unitUid);
    setIsDeleting(noteId);

    // Optimistic: remove from list
    const previousNotes = [...notes];
    setNotes(prev => prev.filter(n => n.id !== noteId));

    try {
      const res = await fetch(
        `/api/purchaser/notes/${noteId}?unitUid=${encodeURIComponent(unitUid)}&token=${encodeURIComponent(token)}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        throw new Error('Failed to delete note');
      }

      if (mountedRef.current) {
        const updatedNotes = previousNotes.filter(n => n.id !== noteId);
        setCachedNotes(unitUid, updatedNotes);
      }

      return true;
    } catch (err) {
      // Rollback
      if (mountedRef.current) {
        setNotes(previousNotes);
        setError('Failed to delete note');
      }
      return false;
    } finally {
      if (mountedRef.current) {
        setIsDeleting(null);
      }
    }
  }, [unitUid, notes]);

  // ─── Toggle Pin (Optimistic) ────────────────────────────────────────

  const togglePin = useCallback(async (noteId: string): Promise<boolean> => {
    if (!unitUid) return false;

    const token = getEffectiveToken(unitUid);
    const note = notes.find(n => n.id === noteId);
    if (!note) return false;

    const newPinned = !note.pinned;

    // Optimistic update
    setNotes(prev => {
      const updated = prev.map(n =>
        n.id === noteId ? { ...n, pinned: newPinned } : n
      );
      return updated.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    });

    try {
      const res = await fetch('/api/purchaser/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, unitUid, noteId, pinned: newPinned }),
      });

      if (!res.ok) {
        throw new Error('Failed to update pin');
      }

      return true;
    } catch (err) {
      // Rollback
      if (mountedRef.current) {
        setNotes(prev => {
          const updated = prev.map(n =>
            n.id === noteId ? { ...n, pinned: note.pinned } : n
          );
          return updated.sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
        });
      }
      return false;
    }
  }, [unitUid, notes]);

  return {
    notes,
    isLoading,
    error,
    addNote,
    deleteNote,
    togglePin,
    refresh: fetchNotes,
    isAdding,
    isDeleting,
  };
}
