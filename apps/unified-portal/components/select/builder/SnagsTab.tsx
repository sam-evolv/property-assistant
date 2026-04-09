'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  AlertTriangle,
  CheckCircle,
  Plus,
  Clock,
  X,
  MessageSquare,
} from 'lucide-react';
import { colors, EASE } from '@/components/select/builder/tokens';

// ─── Types ───────────────────────────────────────────────────────────────────

type Severity = 'low' | 'medium' | 'high' | 'urgent';
type Status = 'open' | 'in_progress' | 'resolved' | 'closed';
type Category =
  | 'general'
  | 'plumbing'
  | 'electrical'
  | 'structural'
  | 'finishing'
  | 'external'
  | 'appliances'
  | 'other';
type SortMode = 'recent' | 'severity' | 'category';
type FilterMode = 'all' | 'open' | 'in_progress' | 'resolved';

interface Snag {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  category: Category;
  severity: Severity;
  status: Status;
  reported_by: string;
  photo_url: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
}

interface SnagsTabProps {
  projectId: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_ORDER: Status[] = ['open', 'in_progress', 'resolved', 'closed'];

const STATUS_LABELS: Record<Status, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const SEVERITY_ORDER: Record<Severity, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const SEVERITY_COLORS: Record<Severity, string> = {
  urgent: colors.red,
  high: colors.amber,
  medium: colors.textSecondary,
  low: colors.textMuted,
};

const CATEGORY_LABELS: Record<Category, string> = {
  general: 'General',
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  structural: 'Structural',
  finishing: 'Finishing',
  external: 'External',
  appliances: 'Appliances',
  other: 'Other',
};

const FILTER_OPTIONS: { key: FilterMode; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
];

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'recent', label: 'Most recent' },
  { key: 'severity', label: 'Severity' },
  { key: 'category', label: 'Category' },
];

const CATEGORIES: Category[] = [
  'general',
  'plumbing',
  'electrical',
  'structural',
  'finishing',
  'external',
  'appliances',
  'other',
];

const SEVERITIES: Severity[] = ['low', 'medium', 'high', 'urgent'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
}

function nextStatus(current: Status): Status {
  const idx = STATUS_ORDER.indexOf(current);
  if (idx < STATUS_ORDER.length - 1) return STATUS_ORDER[idx + 1];
  return STATUS_ORDER[0];
}

// ─── Add Snag Modal ──────────────────────────────────────────────────────────

function AddSnagModal({
  onClose,
  onSubmit,
  submitting,
}: {
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    category: Category;
    severity: Severity;
  }) => void;
  submitting: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('general');
  const [severity, setSeverity] = useState<Severity>('medium');

  const canSubmit = title.trim().length > 0 && !submitting;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: colors.surface2,
          border: `1px solid ${colors.border}`,
          borderRadius: 16,
          padding: 24,
          width: '100%',
          maxWidth: 480,
          margin: '0 16px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: colors.textPrimary,
            }}
          >
            Add Snag
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: colors.textMuted,
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Title */}
        <label
          style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 500,
            color: colors.textSecondary,
            marginBottom: 6,
          }}
        >
          Title *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Cracked tile in master en suite"
          style={{
            width: '100%',
            padding: '10px 12px',
            background: colors.surface1,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            color: colors.textPrimary,
            fontSize: 14,
            outline: 'none',
            marginBottom: 16,
            boxSizing: 'border-box',
          }}
        />

        {/* Description */}
        <label
          style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 500,
            color: colors.textSecondary,
            marginBottom: 6,
          }}
        >
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Details about the issue..."
          rows={3}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: colors.surface1,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            color: colors.textPrimary,
            fontSize: 14,
            outline: 'none',
            resize: 'vertical',
            marginBottom: 16,
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />

        {/* Category + Severity row */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 500,
                color: colors.textSecondary,
                marginBottom: 6,
              }}
            >
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: colors.surface1,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                color: colors.textPrimary,
                fontSize: 13,
                outline: 'none',
                cursor: 'pointer',
                appearance: 'none',
                boxSizing: 'border-box',
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 500,
                color: colors.textSecondary,
                marginBottom: 6,
              }}
            >
              Severity
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as Severity)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: colors.surface1,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                color: colors.textPrimary,
                fontSize: 13,
                outline: 'none',
                cursor: 'pointer',
                appearance: 'none',
                boxSizing: 'border-box',
              }}
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={() => {
            if (!canSubmit) return;
            onSubmit({ title: title.trim(), description, category, severity });
          }}
          disabled={!canSubmit}
          style={{
            width: '100%',
            padding: '12px 0',
            background: canSubmit ? colors.gold : colors.surface3,
            color: canSubmit ? colors.bg : colors.textMuted,
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: canSubmit ? 'pointer' : 'default',
            transition: `all 0.2s ${EASE}`,
          }}
        >
          {submitting ? 'Adding...' : 'Add Snag'}
        </button>
      </div>
    </div>
  );
}

// ─── Resolve Modal ───────────────────────────────────────────────────────────

function ResolveModal({
  snag,
  onClose,
  onSubmit,
  submitting,
}: {
  snag: Snag;
  onClose: () => void;
  onSubmit: (note: string) => void;
  submitting: boolean;
}) {
  const [note, setNote] = useState('');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: colors.surface2,
          border: `1px solid ${colors.border}`,
          borderRadius: 16,
          padding: 24,
          width: '100%',
          maxWidth: 440,
          margin: '0 16px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: colors.textPrimary,
            }}
          >
            Resolve: {snag.title}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: colors.textMuted,
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <label
          style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 500,
            color: colors.textSecondary,
            marginBottom: 6,
          }}
        >
          Resolution note
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="How was this resolved?"
          rows={3}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: colors.surface1,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            color: colors.textPrimary,
            fontSize: 14,
            outline: 'none',
            resize: 'vertical',
            marginBottom: 16,
            fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
        />

        <button
          onClick={() => onSubmit(note)}
          disabled={submitting}
          style={{
            width: '100%',
            padding: '12px 0',
            background: colors.green,
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: submitting ? 'default' : 'pointer',
            opacity: submitting ? 0.6 : 1,
            transition: `all 0.2s ${EASE}`,
          }}
        >
          {submitting ? 'Resolving...' : 'Mark as Resolved'}
        </button>
      </div>
    </div>
  );
}

// ─── Snag Card ───────────────────────────────────────────────────────────────

function SnagCard({
  snag,
  onStatusChange,
  onResolve,
}: {
  snag: Snag;
  onStatusChange: (id: string, status: Status) => void;
  onResolve: (snag: Snag) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const severityColor = SEVERITY_COLORS[snag.severity];

  return (
    <div
      style={{
        background: colors.surface1,
        border: `1px solid ${hovered ? colors.borderHover : colors.border}`,
        borderRadius: 12,
        padding: 16,
        borderLeft: `3px solid ${severityColor}`,
        transition: `border-color 0.2s ${EASE}`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top row: severity pill + title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: severityColor,
            background: `${severityColor}18`,
            padding: '3px 8px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {snag.severity}
        </span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: colors.textPrimary,
            lineHeight: '1.4',
          }}
        >
          {snag.title}
        </span>
      </div>

      {/* Subtitle: category + reported time */}
      <div
        style={{
          fontSize: 12,
          color: colors.textMuted,
          marginBottom: snag.description ? 10 : 12,
          paddingLeft: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ color: colors.textSecondary }}>
          {CATEGORY_LABELS[snag.category]}
        </span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>Reported {relativeTime(snag.created_at)}</span>
      </div>

      {/* Description */}
      {snag.description && (
        <div
          style={{
            fontSize: 13,
            color: colors.textSecondary,
            lineHeight: '1.5',
            marginBottom: 12,
            fontStyle: 'italic',
            opacity: 0.85,
          }}
        >
          &ldquo;{snag.description}&rdquo;
        </div>
      )}

      {/* Resolution note (if resolved/closed) */}
      {snag.resolution_note && (snag.status === 'resolved' || snag.status === 'closed') && (
        <div
          style={{
            fontSize: 12,
            color: colors.green,
            background: `${colors.green}12`,
            borderRadius: 8,
            padding: '8px 10px',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
          }}
        >
          <CheckCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ lineHeight: '1.4' }}>{snag.resolution_note}</span>
        </div>
      )}

      {/* Action row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {/* Status cycle button */}
        <button
          onClick={() => onStatusChange(snag.id, nextStatus(snag.status))}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 500,
            color: colors.textSecondary,
            background: colors.surface3,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            cursor: 'pointer',
            transition: `all 0.15s ${EASE}`,
          }}
        >
          {snag.status === 'open' && <Clock size={12} />}
          {snag.status === 'in_progress' && <Clock size={12} />}
          {snag.status === 'resolved' && <CheckCircle size={12} />}
          {snag.status === 'closed' && <AlertTriangle size={12} />}
          {STATUS_LABELS[snag.status]}
          <span style={{ opacity: 0.5, marginLeft: 2 }}>&#9662;</span>
        </button>

        {/* Add note — placeholder (no note system yet, just the button) */}
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 500,
            color: colors.textMuted,
            background: 'transparent',
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            cursor: 'pointer',
            transition: `all 0.15s ${EASE}`,
          }}
          onClick={() => onResolve(snag)}
        >
          <MessageSquare size={12} />
          Add note
        </button>

        {/* Mark Resolved (only show if not already resolved/closed) */}
        {snag.status !== 'resolved' && snag.status !== 'closed' && (
          <button
            onClick={() => onResolve(snag)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              color: '#fff',
              background: colors.green,
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              marginLeft: 'auto',
              transition: `all 0.15s ${EASE}`,
            }}
          >
            <CheckCircle size={12} />
            Mark Resolved
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SnagsTab({ projectId }: SnagsTabProps) {
  const supabase = createClientComponentClient();

  const [snags, setSnags] = useState<Snag[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [sort, setSort] = useState<SortMode>('recent');
  const [showAddModal, setShowAddModal] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<Snag | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ─── Fetch snags ─────────────────────────────────────────────────────────

  const fetchSnags = useCallback(async () => {
    const { data, error } = await supabase
      .from('select_project_snags')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSnags(data as Snag[]);
    }
    setLoading(false);
  }, [supabase, projectId]);

  useEffect(() => {
    fetchSnags();
  }, [fetchSnags]);

  // ─── Filter + Sort ───────────────────────────────────────────────────────

  const displayed = useMemo(() => {
    let list = [...snags];

    // Filter
    if (filter !== 'all') {
      list = list.filter((s) => s.status === filter);
    }

    // Sort
    if (sort === 'recent') {
      list.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else if (sort === 'severity') {
      list.sort(
        (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
      );
    } else if (sort === 'category') {
      list.sort((a, b) => a.category.localeCompare(b.category));
    }

    return list;
  }, [snags, filter, sort]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleAddSnag = useCallback(
    async (data: {
      title: string;
      description: string;
      category: Category;
      severity: Severity;
    }) => {
      setSubmitting(true);
      const { error } = await supabase.from('select_project_snags').insert({
        project_id: projectId,
        title: data.title,
        description: data.description || null,
        category: data.category,
        severity: data.severity,
        status: 'open',
        reported_by: 'builder',
      });
      if (!error) {
        setShowAddModal(false);
        await fetchSnags();
      }
      setSubmitting(false);
    },
    [supabase, projectId, fetchSnags]
  );

  const handleStatusChange = useCallback(
    async (id: string, newStatus: Status) => {
      const updatePayload: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      // If transitioning to resolved, set resolved_at
      if (newStatus === 'resolved') {
        updatePayload.resolved_at = new Date().toISOString();
      }

      await supabase
        .from('select_project_snags')
        .update(updatePayload)
        .eq('id', id);

      await fetchSnags();
    },
    [supabase, fetchSnags]
  );

  const handleResolve = useCallback(
    async (note: string) => {
      if (!resolveTarget) return;
      setSubmitting(true);

      await supabase
        .from('select_project_snags')
        .update({
          status: 'resolved' as Status,
          resolved_at: new Date().toISOString(),
          resolution_note: note || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resolveTarget.id);

      setResolveTarget(null);
      setSubmitting(false);
      await fetchSnags();
    },
    [supabase, resolveTarget, fetchSnags]
  );

  // ─── Counts for filter pills ─────────────────────────────────────────────

  const counts = useMemo(() => {
    const c = { all: snags.length, open: 0, in_progress: 0, resolved: 0 };
    for (const s of snags) {
      if (s.status === 'open') c.open++;
      else if (s.status === 'in_progress') c.in_progress++;
      else if (s.status === 'resolved') c.resolved++;
    }
    return c;
  }, [snags]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 0 }}>
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <AlertTriangle size={18} style={{ color: colors.gold }} />
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: colors.textPrimary,
            }}
          >
            Snags
          </span>
          <span
            style={{
              fontSize: 13,
              color: colors.textMuted,
              marginLeft: 4,
            }}
          >
            ({snags.length})
          </span>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            color: colors.bg,
            background: colors.gold,
            border: 'none',
            borderRadius: 10,
            cursor: 'pointer',
            transition: `all 0.2s ${EASE}`,
          }}
        >
          <Plus size={14} />
          Add Snag
        </button>
      </div>

      {/* Filter row + Sort */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6 }}>
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 16,
                  fontSize: 12,
                  fontWeight: 500,
                  border: active
                    ? `1px solid ${colors.gold}`
                    : `1px solid ${colors.border}`,
                  background: active ? `${colors.gold}14` : 'transparent',
                  color: active ? colors.gold : colors.textMuted,
                  cursor: 'pointer',
                  transition: `all 0.15s ${EASE}`,
                }}
              >
                {opt.label}
                {counts[opt.key] > 0 && (
                  <span style={{ marginLeft: 4, opacity: 0.7 }}>
                    {counts[opt.key]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sort dropdown */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            background: colors.surface2,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            color: colors.textSecondary,
            outline: 'none',
            cursor: 'pointer',
            appearance: 'none',
          }}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Snag cards */}
      {loading ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 0',
            color: colors.textMuted,
            fontSize: 13,
          }}
        >
          Loading snags...
        </div>
      ) : displayed.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 0',
            color: colors.textMuted,
            fontSize: 13,
          }}
        >
          {filter === 'all'
            ? 'No snags logged yet. Click "+ Add Snag" to create one.'
            : `No ${STATUS_LABELS[filter as Status].toLowerCase()} snags.`}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {displayed.map((snag) => (
            <SnagCard
              key={snag.id}
              snag={snag}
              onStatusChange={handleStatusChange}
              onResolve={setResolveTarget}
            />
          ))}
        </div>
      )}

      {/* Add Snag Modal */}
      {showAddModal && (
        <AddSnagModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddSnag}
          submitting={submitting}
        />
      )}

      {/* Resolve Modal */}
      {resolveTarget && (
        <ResolveModal
          snag={resolveTarget}
          onClose={() => setResolveTarget(null)}
          onSubmit={handleResolve}
          submitting={submitting}
        />
      )}
    </div>
  );
}
