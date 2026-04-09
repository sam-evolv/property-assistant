'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Plus, CheckCircle, Clock, MessageSquare, X, Send } from 'lucide-react';
import { colors, EASE } from '@/components/select/builder/tokens';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type SelectionStatus = 'pending' | 'sent' | 'approved' | 'queried' | 'finalised';

interface Selection {
  id: string;
  project_id: string;
  category: string;
  item_name: string;
  description: string | null;
  supplier: string | null;
  reference: string | null;
  thumbnail_url: string | null;
  status: SelectionStatus;
  homeowner_notes: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */

const CATEGORIES = [
  'Kitchen',
  'Flooring',
  'Tiles',
  'Paint',
  'Windows & Doors',
  'Sanitary Ware',
  'Other',
] as const;

const FILTER_OPTIONS = [...CATEGORIES, 'All'] as const;
type FilterCategory = (typeof FILTER_OPTIONS)[number];

const STATUS_CONFIG: Record<
  SelectionStatus,
  { label: string; bg: string; color: string }
> = {
  pending:   { label: 'Awaiting review',          bg: colors.textMuted, color: '#fff' },
  sent:      { label: 'Sent to homeowner',        bg: colors.blue,      color: '#fff' },
  approved:  { label: 'Approved \u2713',           bg: colors.green,     color: '#fff' },
  queried:   { label: 'Homeowner has a question',  bg: colors.amber,     color: '#fff' },
  finalised: { label: 'Finalised',                 bg: colors.gold,      color: colors.bg },
};

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function SelectionsTab({ projectId }: { projectId: string }) {
  const supabase = createClientComponentClient();

  const [selections, setSelections] = useState<Selection[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterCategory>('All');
  const [showForm, setShowForm] = useState(false);
  const [hoveredPill, setHoveredPill] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  /* form state */
  const [formCategory, setFormCategory] = useState<string>(CATEGORIES[0]);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSupplier, setFormSupplier] = useState('');
  const [formReference, setFormReference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /* ─── Fetch ──────────────────────────────────────────────────────────── */

  const fetchSelections = useCallback(async () => {
    const { data } = await supabase
      .from('select_project_selections')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (data) setSelections(data as Selection[]);
    setLoading(false);
  }, [supabase, projectId]);

  useEffect(() => {
    fetchSelections();
  }, [fetchSelections]);

  /* ─── Submit ─────────────────────────────────────────────────────────── */

  const handleSubmit = async () => {
    if (!formName.trim()) return;
    setSubmitting(true);
    await supabase.from('select_project_selections').insert({
      project_id: projectId,
      category: formCategory,
      item_name: formName.trim(),
      description: formDescription.trim() || null,
      supplier: formSupplier.trim() || null,
      reference: formReference.trim() || null,
      status: 'pending',
    });
    setFormName('');
    setFormDescription('');
    setFormSupplier('');
    setFormReference('');
    setShowForm(false);
    setSubmitting(false);
    fetchSelections();
  };

  /* ─── Filtered + sorted (queried first) ──────────────────────────────── */

  const filtered = selections
    .filter((s) => filter === 'All' || s.category === filter)
    .sort((a, b) => {
      if (a.status === 'queried' && b.status !== 'queried') return -1;
      if (a.status !== 'queried' && b.status === 'queried') return 1;
      return 0;
    });

  /* ─── Helpers ────────────────────────────────────────────────────────── */

  function formatDate(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
  }

  /* ─── Input styles ───────────────────────────────────────────────────── */

  const inputBase: React.CSSProperties = {
    background: colors.surface2,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    color: colors.textPrimary,
    padding: '8px 12px',
    fontSize: 13,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    transition: `border-color 200ms ${EASE}`,
  };

  /* ─── Render ─────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div style={{ color: colors.textSecondary, fontSize: 14, padding: 40 }}>
        Loading selections...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, position: 'relative' }}>
      {/* ─── Header row ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: colors.gold,
              marginBottom: 4,
            }}
          >
            Selections
          </div>
          <div style={{ fontSize: 13, color: colors.textSecondary }}>
            {filtered.length} item{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 8,
            border: `1px solid ${colors.gold}`,
            background: 'transparent',
            color: colors.gold,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            transition: `all 200ms ${EASE}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `${colors.gold}15`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <Plus size={14} />
          Add Selection
        </button>
      </div>

      {/* ─── Category filter pills ─── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          marginBottom: 20,
        }}
      >
        {FILTER_OPTIONS.map((cat) => {
          const isActive = filter === cat;
          const isHovered = hoveredPill === cat;
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              onMouseEnter={() => setHoveredPill(cat)}
              onMouseLeave={() => setHoveredPill(null)}
              style={{
                padding: '5px 14px',
                borderRadius: 14,
                border: `1px solid ${isActive ? colors.gold : isHovered ? colors.borderHover : colors.border}`,
                background: isActive ? `${colors.gold}18` : 'transparent',
                color: isActive ? colors.gold : colors.textSecondary,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: `all 200ms ${EASE}`,
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* ─── Selection cards ─── */}
      {filtered.length === 0 && (
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: colors.textMuted,
            fontSize: 13,
          }}
        >
          No selections{filter !== 'All' ? ` in ${filter}` : ''} yet.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((sel) => {
          const cfg = STATUS_CONFIG[sel.status] || STATUS_CONFIG.pending;
          const isQueried = sel.status === 'queried';
          const isHovered = hoveredCard === sel.id;

          return (
            <div
              key={sel.id}
              onMouseEnter={() => setHoveredCard(sel.id)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: 14,
                borderRadius: 12,
                background: colors.surface1,
                border: `1px solid ${isHovered ? colors.borderHover : colors.border}`,
                borderLeft: isQueried
                  ? `3px solid ${colors.amber}`
                  : `1px solid ${isHovered ? colors.borderHover : colors.border}`,
                transition: `all 200ms ${EASE}`,
                cursor: 'default',
              }}
            >
              {/* Thumbnail placeholder */}
              {sel.thumbnail_url ? (
                <img
                  src={sel.thumbnail_url}
                  alt={sel.item_name}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 8,
                    objectFit: 'cover',
                    flexShrink: 0,
                    border: `1px solid ${colors.border}`,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 8,
                    background: colors.surface2,
                    border: `1px solid ${colors.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 18,
                    color: colors.textMuted,
                  }}
                >
                  {sel.category === 'Kitchen' && '\uD83C\uDF73'}
                  {sel.category === 'Flooring' && '\uD83E\uDDF1'}
                  {sel.category === 'Tiles' && '\u25A6'}
                  {sel.category === 'Paint' && '\uD83C\uDFA8'}
                  {sel.category === 'Windows & Doors' && '\uD83E\uDE9F'}
                  {sel.category === 'Sanitary Ware' && '\uD83D\uDEB0'}
                  {sel.category === 'Other' && '\u2726'}
                </div>
              )}

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Category label */}
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: colors.textMuted,
                    marginBottom: 3,
                  }}
                >
                  {sel.category}
                </div>

                {/* Item name */}
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.textPrimary,
                    marginBottom: 2,
                  }}
                >
                  {sel.item_name}
                </div>

                {/* Description + supplier */}
                {(sel.description || sel.supplier) && (
                  <div
                    style={{
                      fontSize: 12,
                      color: colors.textSecondary,
                      marginBottom: 3,
                    }}
                  >
                    {sel.description}
                    {sel.description && sel.supplier && ' \u2014 '}
                    {sel.supplier}
                  </div>
                )}

                {/* Reference */}
                {sel.reference && (
                  <div
                    style={{
                      fontSize: 11,
                      color: colors.textMuted,
                      marginBottom: 6,
                    }}
                  >
                    Ref: {sel.reference}
                  </div>
                )}

                {/* Status pill + date */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 10px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 600,
                      background: cfg.bg,
                      color: cfg.color,
                    }}
                  >
                    {sel.status === 'approved' && <CheckCircle size={11} />}
                    {sel.status === 'pending' && <Clock size={11} />}
                    {sel.status === 'sent' && <Send size={11} />}
                    {sel.status === 'queried' && <MessageSquare size={11} />}
                    {sel.status === 'finalised' && <CheckCircle size={11} />}
                    {cfg.label}
                  </span>
                  {sel.approved_at && (
                    <span style={{ fontSize: 11, color: colors.textMuted }}>
                      Approved {formatDate(sel.approved_at)}
                    </span>
                  )}
                </div>

                {/* Queried: homeowner notes */}
                {isQueried && sel.homeowner_notes && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: colors.surface2,
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: colors.amber,
                        marginBottom: 4,
                      }}
                    >
                      Homeowner note
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontStyle: 'italic',
                        color: colors.textSecondary,
                        lineHeight: 1.5,
                      }}
                    >
                      {sel.homeowner_notes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Add Selection Modal / Slide-up ─── */}
      {showForm && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowForm(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 999,
              transition: `opacity 250ms ${EASE}`,
            }}
          />

          {/* Modal */}
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 1000,
              background: colors.surface1,
              borderTop: `1px solid ${colors.border}`,
              borderRadius: '16px 16px 0 0',
              padding: '24px 24px 32px',
              maxHeight: '85vh',
              overflowY: 'auto',
              animation: 'selectionsSlideUp 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            {/* Modal header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: colors.textPrimary,
                }}
              >
                Add Selection
              </div>
              <button
                onClick={() => setShowForm(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  background: 'transparent',
                  color: colors.textSecondary,
                  cursor: 'pointer',
                  transition: `all 200ms ${EASE}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = colors.borderHover;
                  e.currentTarget.style.color = colors.textPrimary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = colors.border;
                  e.currentTarget.style.color = colors.textSecondary;
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Form fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Category */}
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: colors.textSecondary,
                    marginBottom: 4,
                    display: 'block',
                  }}
                >
                  Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  style={{
                    ...inputBase,
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca8bc' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    paddingRight: 36,
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = colors.gold; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = colors.border; }}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} style={{ background: colors.surface2, color: colors.textPrimary }}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Item name */}
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: colors.textSecondary,
                    marginBottom: 4,
                    display: 'block',
                  }}
                >
                  Item Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Kitchen Units"
                  style={inputBase}
                  onFocus={(e) => { e.currentTarget.style.borderColor = colors.gold; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = colors.border; }}
                />
              </div>

              {/* Description */}
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: colors.textSecondary,
                    marginBottom: 4,
                    display: 'block',
                  }}
                >
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. Handleless White Gloss"
                  rows={3}
                  style={{
                    ...inputBase,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = colors.gold; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = colors.border; }}
                />
              </div>

              {/* Supplier */}
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: colors.textSecondary,
                    marginBottom: 4,
                    display: 'block',
                  }}
                >
                  Supplier
                </label>
                <input
                  type="text"
                  value={formSupplier}
                  onChange={(e) => setFormSupplier(e.target.value)}
                  placeholder="e.g. Cawleys"
                  style={inputBase}
                  onFocus={(e) => { e.currentTarget.style.borderColor = colors.gold; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = colors.border; }}
                />
              </div>

              {/* Reference number */}
              <div>
                <label
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: colors.textSecondary,
                    marginBottom: 4,
                    display: 'block',
                  }}
                >
                  Reference Number
                </label>
                <input
                  type="text"
                  value={formReference}
                  onChange={(e) => setFormReference(e.target.value)}
                  placeholder="e.g. KU-WG-42"
                  style={inputBase}
                  onFocus={(e) => { e.currentTarget.style.borderColor = colors.gold; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = colors.border; }}
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!formName.trim() || submitting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: !formName.trim() || submitting ? colors.surface3 : colors.gold,
                  color: !formName.trim() || submitting ? colors.textMuted : colors.bg,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: !formName.trim() || submitting ? 'not-allowed' : 'pointer',
                  transition: `all 200ms ${EASE}`,
                  marginTop: 4,
                }}
                onMouseEnter={(e) => {
                  if (formName.trim() && !submitting) {
                    e.currentTarget.style.opacity = '0.9';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                <Plus size={15} />
                {submitting ? 'Adding...' : 'Add Selection'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── Keyframes ─── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes selectionsSlideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      ` }} />
    </div>
  );
}
