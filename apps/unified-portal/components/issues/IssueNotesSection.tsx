'use client';

/**
 * Notes section in the issue detail. Spec section 6.5.
 *
 * - New-note textarea + Send button at the top.
 * - List of existing notes newest-first below.
 * - POST /api/issues/[id]/notes inserts the note and the parent
 *   appends the new note to the list optimistically via onAdded.
 */

import { useState } from 'react';
import { Send } from 'lucide-react';
import { IssueNote } from './types';

interface IssueNotesSectionProps {
  issueId: string;
  notes: IssueNote[];
  onAdded: (note: IssueNote) => void;
}

const MAX_NOTE_LEN = 2000;

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function authorDisplay(note: IssueNote): string {
  if (note.author_email) return note.author_email;
  if (note.author_role) return note.author_role.replace('_', ' ');
  return 'Team member';
}

export function IssueNotesSection({ issueId, notes, onAdded }: IssueNotesSectionProps) {
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = draft.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= MAX_NOTE_LEN && !submitting;

  const submit = async () => {
    if (!canSend) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/issues/${issueId}/notes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: trimmed }),
      });
      if (!res.ok) {
        let message = "Couldn't save that note.";
        try {
          const json = await res.json();
          if (typeof json?.error === 'string' && json.error.length < 200) message = json.error;
        } catch {
          // ignore
        }
        setError(message);
        return;
      }
      const json = await res.json();
      if (json?.note) {
        onAdded(json.note as IssueNote);
        setDraft('');
      }
    } catch {
      setError("Couldn't save that note.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-3">
      <h3 className="text-body-sm font-semibold text-neutral-900">Notes</h3>

      <div className="rounded-lg border border-neutral-200 bg-white">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_NOTE_LEN))}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Add a note for the team"
          rows={3}
          className="w-full resize-none rounded-t-lg px-3 py-2 text-body-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <div className="flex items-center justify-between px-3 py-2 border-t border-neutral-100">
          <span className="text-caption text-neutral-500">
            {trimmed.length}/{MAX_NOTE_LEN}
          </span>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSend}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 text-white rounded-md text-body-sm font-medium disabled:bg-neutral-200 disabled:text-neutral-400 hover:bg-brand-600 min-h-[36px]"
          >
            <Send className="w-3.5 h-3.5" />
            {submitting ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-body-sm text-red-700">
          {error}
        </div>
      ) : null}

      {notes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-body-sm text-neutral-500">
          No notes yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-body-sm font-medium text-neutral-900 truncate">
                  {authorDisplay(note)}
                </span>
                <span className="text-caption text-neutral-500 ml-auto whitespace-nowrap">
                  {formatTimestamp(note.created_at)}
                </span>
              </div>
              <p className="mt-1 text-body-sm text-neutral-700 whitespace-pre-wrap break-words">
                {note.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
