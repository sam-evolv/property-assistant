'use client';

/**
 * Sprint 3.5a.3 homeowner detail page. Single scrolling profile.
 *
 * Layout, top to bottom:
 *   1. Hero strip: rounded-square gold avatar tile, name, subtitle,
 *      three info tags (house type, handover, docs). Right side has
 *      a Message button and a kebab menu.
 *   2. Reported Issues card (gated on FEATURE_HOMEOWNER_ISSUES). All
 *      amber-on-amber text inside the card now reads against
 *      WCAG AA after the 3.5a.3 readability pass.
 *   3. Two-by-two grid of compact cards: Contact, House, Access,
 *      Documents.
 *   4. Activity stat strip: four columns (messages, engagement,
 *      last active, open issues).
 *   5. Danger Zone (delete homeowner).
 *
 * Editing is no longer inline. The Edit link on the Contact card
 * routes to the dedicated edit page under /edit on this same route
 * family, which keeps detail-client free of form state.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  Home,
  Key,
  Folder,
  MessageSquare,
  MoreHorizontal,
  Copy,
  QrCode,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  AlertTriangle,
  BarChart3,
  Activity,
  Trash2,
  Check,
  FileText,
} from 'lucide-react';
import { isHomeownerIssuesEnabled } from '@/lib/feature-flags';
import { HomeownerIssuesCard } from '@/components/homeowners/HomeownerIssuesCard';
import { HomeownerIssue } from '@/components/homeowners/types';

interface HomeownerDetails {
  homeowner: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    house_type: string | null;
    address: string | null;
    unique_qr_token: string;
    access_code: string | null;
    handover_date: string | null;
    is_handed_over: boolean;
    portal_type: 'pre_handover' | 'property_assistant';
    development_id: string;
    created_at: string;
    floor_area?: string | null;
    ber_rating?: string | null;
    development: {
      id: string;
      name: string;
      address: string;
    };
  };
  activity: {
    total_messages: number;
    user_messages: number;
    assistant_messages: number;
    first_message: string | null;
    last_message: string | null;
    is_active_this_week: boolean;
    engagement_level: 'high' | 'medium' | 'low' | 'none';
  };
  acknowledgement: {
    agreed_at: string;
    purchaser_name: string;
    ip_address: string | null;
    user_agent: string | null;
    docs_version: number;
    documents_acknowledged: { id: string; title: string }[];
  } | null;
  noticeboard_terms: {
    accepted_at: string;
  } | null;
}

export function HomeownerDetailClient({ homeownerId }: { homeownerId: string }) {
  const router = useRouter();
  const [data, setData] = useState<HomeownerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'code' | 'url' | null>(null);
  const [openIssuesCount, setOpenIssuesCount] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const response = await fetch(`/api/homeowners/${homeownerId}/details`);
        if (!alive) return;
        if (response.ok) {
          const result = await response.json();
          setData(result);
        } else {
          setError('Failed to load homeowner details');
        }
      } catch {
        if (alive) setError('An error occurred while loading homeowner details');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [homeownerId]);

  const handleIssuesLoaded = useCallback((issues: HomeownerIssue[]) => {
    const open = issues.filter((i) => i.status !== 'resolved').length;
    setOpenIssuesCount(open);
  }, []);

  async function handleDelete() {
    setDeleting(true);
    try {
      const response = await fetch(`/api/homeowners/${homeownerId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        router.push('/developer/homeowners');
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to delete homeowner');
      }
    } catch {
      alert('An error occurred while deleting');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  function copyToClipboard(text: string, which: 'code' | 'url') {
    navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

  function getQRPortalUrl() {
    if (typeof window !== 'undefined' && data?.homeowner.unique_qr_token) {
      return `${window.location.origin}/homes/${data.homeowner.unique_qr_token}`;
    }
    return '';
  }

  function formatDate(iso: string | null | undefined): string {
    if (!iso) return 'Not recorded';
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function formatRelativeTime(iso: string | null): string {
    if (!iso) return 'Never';
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diff = Math.max(0, now - then);
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;
    if (diff < minute) return 'Just now';
    if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
    if (diff < day) return `${Math.floor(diff / hour)}h ago`;
    if (diff < week) return `${Math.floor(diff / day)}d ago`;
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function engagementPill(level: string) {
    if (level === 'high') {
      return (
        <span
          className="inline-flex items-center font-semibold bg-emerald-50 text-emerald-700"
          style={{
            fontSize: '12px',
            padding: '3px 9px',
            borderRadius: '999px',
            letterSpacing: '-0.01em',
          }}
        >
          High
        </span>
      );
    }
    const label = level === 'medium' ? 'Medium' : level === 'low' ? 'Low' : 'None';
    return (
      <span
        className="inline-flex items-center font-semibold bg-neutral-100 text-neutral-700"
        style={{
          fontSize: '12px',
          padding: '3px 9px',
          borderRadius: '999px',
          letterSpacing: '-0.01em',
        }}
      >
        {label}
      </span>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading homeowner details...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">{error || 'Homeowner not found'}</p>
          <Link href="/developer/homeowners" className="text-gold-600 hover:text-gold-700 mt-4 inline-block">
            Back to Homeowners
          </Link>
        </div>
      </div>
    );
  }

  const { homeowner, activity, acknowledgement } = data;
  const homeownerIssuesOn = isHomeownerIssuesEnabled();

  const initial = (homeowner.name || 'U').trim().charAt(0).toUpperCase();
  const subtitleSegments = [homeowner.address, homeowner.development?.name].filter(
    (s): s is string => Boolean(s),
  );
  const portalUrl = getQRPortalUrl();

  const docsList = acknowledgement?.documents_acknowledged ?? [];
  const docsTotal = docsList.length;
  const docsToShow = docsList.slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Link
          href="/developer/homeowners"
          className="text-gold-600 hover:text-gold-700 inline-flex items-center gap-1 text-xs mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Homeowners
        </Link>

        {/* Hero strip. Avatar tile, name, subtitle, three info tags. */}
        <div
          data-testid="homeowner-header"
          className="flex items-start justify-between gap-4"
          style={{ paddingBottom: '20px' }}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              data-testid="homeowner-header-avatar"
              className="flex-shrink-0 flex items-center justify-center text-white font-semibold"
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #D4AF37, #B8934C)',
                fontSize: '19px',
                fontWeight: 600,
              }}
            >
              {initial}
            </div>
            <div className="flex flex-col min-w-0">
              <h1
                data-testid="homeowner-header-name"
                className="text-neutral-900"
                style={{
                  fontSize: '22px',
                  fontWeight: 600,
                  letterSpacing: '-0.015em',
                  lineHeight: 1.15,
                }}
              >
                {homeowner.name}
              </h1>
              {subtitleSegments.length > 0 && (
                <p className="text-sm text-neutral-500 mt-0.5 truncate flex items-center gap-1.5">
                  {subtitleSegments.map((segment, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 truncate">
                      {idx > 0 && <span aria-hidden className="text-neutral-300">·</span>}
                      <span className="truncate">{segment}</span>
                    </span>
                  ))}
                </p>
              )}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {homeowner.house_type && (
                  <InfoTag>{homeowner.house_type}</InfoTag>
                )}
                <InfoTag>{homeowner.is_handed_over ? 'Handed over' : 'Pre-handover'}</InfoTag>
                {acknowledgement ? (
                  <InfoTag variant="docs-acknowledged">
                    <Check className="w-3 h-3 text-emerald-500" />
                    Docs acknowledged
                  </InfoTag>
                ) : (
                  <InfoTag>Docs pending</InfoTag>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-700 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              Message
            </button>
            <button
              type="button"
              aria-label="More actions"
              className="p-2 text-neutral-500 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* Reported Issues card. Gated on FEATURE_HOMEOWNER_ISSUES.
            Surfaces homeowner_new items first, with the readability
            fixes from this sprint applied to its inner pills. */}
        {homeownerIssuesOn && (
          <div className="mb-3">
            <HomeownerIssuesCard
              homeownerId={homeownerId}
              homeownerName={homeowner.name}
              onIssuesLoaded={handleIssuesLoaded}
            />
          </div>
        )}

        {/* 2x2 grid of compact cards. Stacks on mobile. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Contact card */}
          <CompactCard
            icon={<User className="text-neutral-400" style={{ width: 13, height: 13 }} />}
            title="Contact"
            action={
              <Link
                href={`/developer/homeowners/${homeownerId}/edit`}
                className="font-medium hover:underline"
                style={{ color: '#B8934C', fontSize: '11px' }}
              >
                Edit
              </Link>
            }
          >
            <KVRow label="Email" value={homeowner.email || 'Not provided'} />
            <KVRow label="Phone" value={homeowner.phone || 'Not provided'} />
            <KVRow label="Added" value={formatDate(homeowner.created_at)} />
            <KVRow
              label="Docs"
              value={acknowledgement ? 'Acknowledged' : 'Pending'}
              valueClassName={acknowledgement ? 'text-emerald-700' : 'text-neutral-900'}
            />
          </CompactCard>

          {/* House card */}
          <CompactCard
            icon={<Home className="text-neutral-400" style={{ width: 13, height: 13 }} />}
            title="House"
            action={
              <button
                type="button"
                className="font-medium hover:underline"
                style={{ color: '#B8934C', fontSize: '11px' }}
              >
                View plans
              </button>
            }
          >
            <KVRow label="Address" value={homeowner.address || 'Not specified'} />
            <KVRow label="Type" value={homeowner.house_type || 'Not specified'} />
            <KVRow label="Floor area" value={homeowner.floor_area || 'Not specified'} />
            <KVRow label="BER rating" value={homeowner.ber_rating || 'Not specified'} />
          </CompactCard>

          {/* Access card */}
          <CompactCard
            icon={<Key className="text-neutral-400" style={{ width: 13, height: 13 }} />}
            title="Access"
            action={
              <a
                href={portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:underline"
                style={{ color: '#B8934C', fontSize: '11px' }}
              >
                Open portal
              </a>
            }
          >
            <div className="flex items-center justify-center gap-2 pt-1">
              <div
                className="font-mono text-neutral-800 text-center bg-neutral-50"
                style={{
                  border: '1px dashed #E5E7EB',
                  padding: '7px 11px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  letterSpacing: '0.06em',
                  fontWeight: 500,
                  minWidth: '120px',
                }}
              >
                {homeowner.access_code || 'No code'}
              </div>
              <button
                type="button"
                aria-label="Copy access code"
                onClick={() => copyToClipboard(homeowner.access_code || '', 'code')}
                className="p-1.5 rounded border border-neutral-200 hover:bg-neutral-50 text-neutral-600 transition-colors"
              >
                {copied === 'code' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                aria-label="Download QR code"
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/qr/generate?unitId=${homeownerId}&format=png`);
                    if (response.ok) {
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `qr-${(homeowner.name || 'homeowner').replace(/\s+/g, '-').toLowerCase()}.png`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      window.URL.revokeObjectURL(url);
                    }
                  } catch {
                    // download failed silently
                  }
                }}
                className="p-1.5 rounded border border-neutral-200 hover:bg-neutral-50 text-neutral-600 transition-colors"
              >
                <QrCode className="w-3.5 h-3.5" />
              </button>
            </div>
            <p
              className="text-center text-neutral-400 mt-2"
              style={{ fontSize: '11.5px' }}
            >
              Grants pre-handover portal access
            </p>
          </CompactCard>

          {/* Documents card */}
          <CompactCard
            icon={<Folder className="text-neutral-400" style={{ width: 13, height: 13 }} />}
            title="Documents"
            action={
              <button
                type="button"
                className="font-medium hover:underline"
                style={{ color: '#B8934C', fontSize: '11px' }}
              >
                View all ({docsTotal})
              </button>
            }
          >
            {docsToShow.length === 0 ? (
              <p className="text-neutral-400 py-2" style={{ fontSize: '12.5px' }}>
                No documents shared yet.
              </p>
            ) : (
              <div className="space-y-1">
                {docsToShow.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2.5 py-1">
                    <div
                      className="flex-shrink-0 flex items-center justify-center bg-gold-50"
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '6px',
                      }}
                    >
                      <FileText className="text-gold-700" style={{ width: 14, height: 14 }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-neutral-900 truncate"
                        style={{ fontSize: '12.5px', fontWeight: 500 }}
                      >
                        {doc.title}
                      </p>
                      <p
                        className="text-neutral-400"
                        style={{ fontSize: '10.5px' }}
                      >
                        Acknowledged
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Open document"
                      className="p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 rounded transition-colors flex-shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CompactCard>
        </div>

        {/* Activity stat strip. */}
        <div
          className="bg-white overflow-hidden mt-3"
          style={{
            border: '1px solid #E5E7EB',
            borderRadius: '10px',
            padding: '14px 16px',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="text-neutral-400" style={{ width: 13, height: 13 }} />
              <span
                className="uppercase font-bold text-neutral-500"
                style={{
                  fontSize: '11px',
                  letterSpacing: '0.06em',
                }}
              >
                Activity
              </span>
            </div>
            <button
              type="button"
              className="font-medium hover:underline"
              style={{ color: '#B8934C', fontSize: '11px' }}
            >
              View timeline
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatBlock
              icon={<MessageSquare className="text-neutral-300" style={{ width: 12, height: 12 }} />}
              label="Messages"
              value={String(activity.total_messages)}
            />
            <StatBlock
              icon={<Activity className="text-neutral-300" style={{ width: 12, height: 12 }} />}
              label="Engagement"
              valueNode={engagementPill(activity.engagement_level)}
            />
            <StatBlock
              icon={<Clock className="text-neutral-300" style={{ width: 12, height: 12 }} />}
              label="Last active"
              value={formatRelativeTime(activity.last_message)}
            />
            <StatBlock
              icon={<AlertTriangle className="text-neutral-300" style={{ width: 12, height: 12 }} />}
              label="Open issues"
              value={openIssuesCount === null ? '...' : String(openIssuesCount)}
            />
          </div>
        </div>

        {/* Danger Zone. Kept tucked at the bottom of the single-scroll
            profile so the delete affordance stays accessible without
            crowding the primary detail surfaces. */}
        <div
          className="bg-white overflow-hidden mt-6"
          style={{
            border: '1px solid #FECACA',
            borderRadius: '10px',
          }}
        >
          <div
            className="bg-red-50 border-b"
            style={{ borderBottom: '1px solid #FEE2E2', padding: '11px 14px' }}
          >
            <h2
              className="text-red-700 flex items-center gap-2 font-semibold"
              style={{ fontSize: '13px' }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Danger Zone
            </h2>
          </div>
          <div style={{ padding: '14px' }}>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
              >
                Delete Homeowner
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-red-600">
                  Are you sure? This action cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoTag({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'docs-acknowledged';
}) {
  const isDocs = variant === 'docs-acknowledged';
  return (
    <span
      className="inline-flex items-center gap-1"
      style={{
        background: isDocs ? '#ECFDF5' : '#F9FAFB',
        border: `1px solid ${isDocs ? '#D1FAE5' : '#F3F4F6'}`,
        color: isDocs ? '#047857' : '#4B5563',
        fontSize: '11px',
        padding: '3px 8px',
        borderRadius: '6px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function CompactCard({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="bg-white overflow-hidden"
      style={{
        border: '1px solid #E5E7EB',
        borderRadius: '10px',
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ padding: '11px 14px 0' }}
      >
        <div className="flex items-center gap-1.5">
          {icon}
          <span
            className="uppercase font-bold text-neutral-500"
            style={{
              fontSize: '11px',
              letterSpacing: '0.06em',
            }}
          >
            {title}
          </span>
        </div>
        {action}
      </div>
      <div style={{ padding: '10px 14px 14px' }}>{children}</div>
    </div>
  );
}

function KVRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div
      className="flex justify-between gap-3 border-t first:border-t-0"
      style={{
        borderTopColor: '#F9FAFB',
        padding: '7px 0',
      }}
    >
      <dt
        className="text-neutral-500 flex-shrink-0"
        style={{ fontSize: '12.5px' }}
      >
        {label}
      </dt>
      <dd
        className={`text-right truncate font-medium ${valueClassName ?? 'text-neutral-900'}`}
        style={{ fontSize: '13px' }}
      >
        {value}
      </dd>
    </div>
  );
}

function StatBlock({
  icon,
  label,
  value,
  valueNode,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5" style={{ marginBottom: '4px' }}>
        {icon}
        <span
          className="uppercase font-semibold text-neutral-400"
          style={{
            fontSize: '10.5px',
            letterSpacing: '0.06em',
          }}
        >
          {label}
        </span>
      </div>
      {valueNode ? (
        <div className="flex items-center">{valueNode}</div>
      ) : (
        <div
          className="text-neutral-900 font-semibold truncate"
          style={{
            fontSize: '20px',
            letterSpacing: '-0.01em',
            lineHeight: 1.1,
          }}
        >
          {value}
        </div>
      )}
    </div>
  );
}
