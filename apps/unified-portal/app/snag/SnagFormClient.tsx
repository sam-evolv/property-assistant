'use client';

/**
 * Phone-first snag capture form. Spec section 7.
 *
 * Layout regions:
 *   1. Header  (title + development switcher)
 *   2. Main    (unit selector, photo capture, title, room, notes)
 *   3. Sticky bottom submit
 *   4. Recent section (last 5 snags by this user in the selected unit)
 *
 * Upload pipeline:
 *   1. compressSelectionsForUpload to stay under Vercel's 4.5 MB body cap
 *   2. POST /api/assistant/media/upload (Path C in media-auth.ts picks up
 *      site_team_members session)
 *   3. POST /api/snag/create with the returned media_ids
 *
 * The Sprint 1 attachments helpers handle the file picker, normalisation,
 * preview URLs, and compression. We reuse them as-is.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Camera, ChevronRight, Plus, X } from 'lucide-react';
import {
  ASSISTANT_MEDIA_ACCEPT,
  ASSISTANT_MEDIA_MAX_FILES,
  compressSelectionsForUpload,
  normalizeFiles,
  rejectionMessage,
  revokeSelections,
  type SelectedAttachment,
} from '@/lib/assistant/attachments';
import { UnitPickerSheet, type SnagUnit } from './UnitPickerSheet';
import { RoomPickerSheet } from './RoomPickerSheet';
import { DevelopmentSwitcherSheet, type SnagDevelopment } from './DevelopmentSwitcherSheet';

interface InitialAuth {
  userId: string;
  email: string;
  tenantId: string;
  role: 'admin' | 'site_team' | 'snagger_external';
  developmentIds: string[] | null;
  isAdmin: boolean;
}

interface SnagFormClientProps {
  initialAuth: InitialAuth;
}

interface RecentSnag {
  id: string;
  title: string;
  unit_id: string;
  created_at: string;
  media_count: number;
  logged_by_user_id: string | null;
}

const TITLE_PLACEHOLDER = 'Hairline crack above door';
const NOTES_PLACEHOLDER = 'Any extra detail';
const PICKER_PLACEHOLDER = 'Tap to select';

const SUBMIT_IDLE = 'Log snag';
const SUBMIT_PENDING = 'Logging snag...';
const TOAST_SUCCESS = 'Snag logged.';
const ERROR_GENERIC = "Couldn't log that snag. Try again.";

const MAX_TITLE_LEN = 120;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

export function SnagFormClient({ initialAuth }: SnagFormClientProps) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [developments, setDevelopments] = useState<SnagDevelopment[]>([]);
  const [developmentId, setDevelopmentId] = useState<string | null>(null);
  const developmentName = useMemo(
    () => developments.find((d) => d.id === developmentId)?.name ?? '',
    [developments, developmentId],
  );

  const [units, setUnits] = useState<SnagUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<SnagUnit | null>(null);

  const [selections, setSelections] = useState<SelectedAttachment[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [room, setRoom] = useState('');

  const [pickerOpen, setPickerOpen] = useState<null | 'unit' | 'room' | 'development'>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [recent, setRecent] = useState<RecentSnag[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  useEffect(() => {
    return () => revokeSelections(selections);
  }, [selections]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/snag/developments', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        const list: SnagDevelopment[] = Array.isArray(json?.developments) ? json.developments : [];
        setDevelopments(list);
        if (list.length > 0) setDevelopmentId((prev) => prev ?? list[0].id);
      } catch (err) {
        console.warn('[snag-form] failed to load developments', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!developmentId) {
      setUnits([]);
      return;
    }
    let cancelled = false;
    setUnitsLoading(true);
    setUnitsError(null);
    (async () => {
      try {
        const res = await fetch(`/api/snag/units?development_id=${encodeURIComponent(developmentId)}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          if (!cancelled) setUnitsError("Couldn't load units. Try again.");
          return;
        }
        const json = await res.json();
        if (cancelled) return;
        const list: SnagUnit[] = Array.isArray(json?.units) ? json.units : [];
        setUnits(list);
      } catch (err) {
        if (!cancelled) setUnitsError("Couldn't load units. Try again.");
      } finally {
        if (!cancelled) setUnitsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [developmentId]);

  const refreshRecent = useCallback(async () => {
    if (!developmentId || !selectedUnit) {
      setRecent([]);
      return;
    }
    setRecentLoading(true);
    try {
      const res = await fetch(
        `/api/snag/list?development_id=${encodeURIComponent(developmentId)}&limit=100`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        setRecent([]);
        return;
      }
      const json = await res.json();
      const rows: RecentSnag[] = Array.isArray(json?.rows) ? json.rows : [];
      const filtered = rows
        .filter((r) => r.unit_id === selectedUnit.id && r.logged_by_user_id === initialAuth.userId)
        .slice(0, 5);
      setRecent(filtered);
    } catch (err) {
      setRecent([]);
    } finally {
      setRecentLoading(false);
    }
  }, [developmentId, selectedUnit, initialAuth.userId]);

  useEffect(() => {
    void refreshRecent();
  }, [refreshRecent]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const remaining = ASSISTANT_MEDIA_MAX_FILES - selections.length;
  const canSubmit = !!developmentId && !!selectedUnit && title.trim().length > 0 && selections.length > 0;

  const onFiles = (files: ArrayLike<File>) => {
    setSubmitError(null);
    const { accepted, rejected } = normalizeFiles(files, remaining);
    if (rejected.length > 0) {
      setSubmitError(rejectionMessage(rejected[0].reason));
    }
    if (accepted.length > 0) {
      setSelections((prev) => [...prev, ...accepted]);
    }
  };

  const removeSelection = (id: string) => {
    setSelections((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target) revokeSelections([target]);
      return prev.filter((s) => s.id !== id);
    });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (list && list.length > 0) onFiles(list);
    e.target.value = '';
  };

  const submit = async () => {
    if (!developmentId || !selectedUnit) return;
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const compressed = await compressSelectionsForUpload(selections);
      const conversationId = uuid();

      const form = new FormData();
      form.set('conversation_id', conversationId);
      form.set('unit_id', selectedUnit.id);
      for (const sel of compressed) {
        form.append('files', sel.file, sel.file.name);
      }

      const uploadRes = await fetch('/api/assistant/media/upload', {
        method: 'POST',
        body: form,
      });
      if (!uploadRes.ok) {
        setSubmitError(ERROR_GENERIC);
        return;
      }
      const uploadJson = await uploadRes.json();
      const mediaIds: string[] = Array.isArray(uploadJson?.media)
        ? uploadJson.media.map((m: { media_id: string }) => m.media_id).filter(Boolean)
        : [];
      if (mediaIds.length === 0) {
        setSubmitError(ERROR_GENERIC);
        return;
      }

      const createRes = await fetch('/api/snag/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          development_id: developmentId,
          unit_id: selectedUnit.id,
          title: title.trim(),
          description: description.trim(),
          room: room.trim(),
          media_ids: mediaIds,
        }),
      });
      if (!createRes.ok) {
        setSubmitError(ERROR_GENERIC);
        return;
      }

      revokeSelections(selections);
      setSelections([]);
      setTitle('');
      setDescription('');
      setRoom('');
      setToast(TOAST_SUCCESS);
      void refreshRecent();
    } catch (err) {
      setSubmitError(ERROR_GENERIC);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="px-4 py-3 bg-white border-b border-neutral-200 flex items-center justify-between gap-3">
        <h1 className="text-heading-md text-neutral-900">Log a snag</h1>
        {developments.length > 1 ? (
          <button
            type="button"
            onClick={() => setPickerOpen('development')}
            className="text-body-sm text-neutral-600 max-w-[180px] truncate active:text-neutral-900 min-h-[44px] px-2"
          >
            {developmentName || 'Pick a development'}
          </button>
        ) : developmentName ? (
          <span className="text-body-sm text-neutral-500 max-w-[180px] truncate">{developmentName}</span>
        ) : null}
      </header>

      <main className="flex-1 px-4 py-6 space-y-4">
        <button
          type="button"
          onClick={() => setPickerOpen('unit')}
          className="w-full px-4 py-4 bg-white border border-neutral-200 rounded-lg text-left flex items-center justify-between min-h-[64px] active:bg-neutral-50"
        >
          <div className="flex-1 min-w-0">
            <div className="text-caption text-neutral-500">Unit</div>
            <div className="text-body text-neutral-900 truncate">
              {selectedUnit?.display_name || PICKER_PLACEHOLDER}
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-neutral-400 flex-shrink-0" />
        </button>

        <div className="space-y-3">
          <div className="text-caption text-neutral-500">Photos</div>
          {selections.length === 0 ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-video bg-white border-2 border-dashed border-neutral-300 rounded-lg flex flex-col items-center justify-center gap-2 active:bg-neutral-50 min-h-[160px]"
            >
              <Camera className="w-8 h-8 text-neutral-400" />
              <span className="text-body-sm text-neutral-600">Take a photo</span>
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {selections.map((sel) => (
                <div key={sel.id} className="relative aspect-square">
                  <img
                    src={sel.previewUrl}
                    alt=""
                    className="w-full h-full rounded-md object-cover border border-neutral-200"
                  />
                  <button
                    type="button"
                    onClick={() => removeSelection(sel.id)}
                    className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-neutral-900 text-white flex items-center justify-center"
                    aria-label="Remove photo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {remaining > 0 ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square bg-white border-2 border-dashed border-neutral-300 rounded-md flex items-center justify-center active:bg-neutral-50"
                  aria-label="Add another photo"
                >
                  <Plus className="w-6 h-6 text-neutral-400" />
                </button>
              ) : null}
            </div>
          )}
          <input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            accept={ASSISTANT_MEDIA_ACCEPT}
            capture="environment"
            multiple
            className="sr-only"
            onChange={handleFileInput}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-caption text-neutral-500 block mb-1" htmlFor="snag-title">
              What is the snag
            </label>
            <input
              id="snag-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={TITLE_PLACEHOLDER}
              maxLength={MAX_TITLE_LEN}
              className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-lg text-body focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[48px]"
            />
          </div>

          <div>
            <label className="text-caption text-neutral-500 block mb-1">Room</label>
            <button
              type="button"
              onClick={() => setPickerOpen('room')}
              className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-lg text-left text-body text-neutral-900 flex items-center justify-between min-h-[48px] active:bg-neutral-50"
            >
              <span className={room ? 'text-neutral-900' : 'text-neutral-500'}>
                {room || PICKER_PLACEHOLDER}
              </span>
              <ChevronRight className="w-5 h-5 text-neutral-400" />
            </button>
          </div>

          <div>
            <label className="text-caption text-neutral-500 block mb-1" htmlFor="snag-notes">
              Notes (optional)
            </label>
            <textarea
              id="snag-notes"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={NOTES_PLACEHOLDER}
              className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-lg text-body focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>
        </div>

        {submitError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-700">
            {submitError}
          </div>
        ) : null}

        <RecentSnagsList loading={recentLoading} rows={recent} hasUnit={!!selectedUnit} />
      </main>

      <div className="sticky bottom-0 px-4 py-3 bg-white border-t border-neutral-200" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="w-full py-3 bg-brand-500 text-white rounded-lg font-medium disabled:bg-neutral-200 disabled:text-neutral-400 active:bg-brand-600 min-h-[48px]"
        >
          {submitting ? SUBMIT_PENDING : SUBMIT_IDLE}
        </button>
      </div>

      {toast ? (
        <div
          className="fixed left-1/2 -translate-x-1/2 bottom-24 z-popover px-4 py-2 bg-neutral-900 text-white text-body-sm rounded-full shadow-lg"
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      ) : null}

      <UnitPickerSheet
        open={pickerOpen === 'unit'}
        units={units}
        loading={unitsLoading}
        error={unitsError}
        selectedId={selectedUnit?.id ?? null}
        onClose={() => setPickerOpen(null)}
        onSelect={(unit) => {
          setSelectedUnit(unit);
          setPickerOpen(null);
        }}
      />

      <RoomPickerSheet
        open={pickerOpen === 'room'}
        selected={room}
        onClose={() => setPickerOpen(null)}
        onSelect={(value) => {
          setRoom(value);
          setPickerOpen(null);
        }}
      />

      <DevelopmentSwitcherSheet
        open={pickerOpen === 'development'}
        developments={developments}
        selectedId={developmentId}
        onClose={() => setPickerOpen(null)}
        onSelect={(dev) => {
          setDevelopmentId(dev.id);
          setSelectedUnit(null);
          setPickerOpen(null);
        }}
      />
    </div>
  );
}

interface RecentSnagsListProps {
  loading: boolean;
  rows: RecentSnag[];
  hasUnit: boolean;
}

function RecentSnagsList({ loading, rows, hasUnit }: RecentSnagsListProps) {
  if (!hasUnit) return null;
  return (
    <section className="pt-4">
      <h2 className="text-caption text-neutral-500 mb-2">Recent</h2>
      {loading ? (
        <div className="text-body-sm text-neutral-500 px-1 py-2">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="text-body-sm text-neutral-500 px-1 py-2">No snags logged in this unit yet.</div>
      ) : (
        <ul className="divide-y divide-neutral-100 bg-white border border-neutral-200 rounded-lg overflow-hidden">
          {rows.map((row) => (
            <li key={row.id}>
              <a
                href={`/snag/${row.id}`}
                className="block px-4 py-3 active:bg-neutral-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-body text-neutral-900 truncate">{row.title}</div>
                    <div className="text-caption text-neutral-500">
                      {row.media_count} {row.media_count === 1 ? 'photo' : 'photos'} . logged {timeAgo(row.created_at)}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-neutral-400 flex-shrink-0" />
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
