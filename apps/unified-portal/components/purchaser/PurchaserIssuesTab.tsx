'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Image as ImageIcon,
  Inbox,
  MessageCircle,
} from 'lucide-react';

interface IssueMedia {
  signed_url: string;
  thumbnail_url: string;
}

interface PurchaserIssue {
  id: string;
  title: string;
  description: string | null;
  room: string | null;
  status: 'homeowner_new' | 'open' | 'reopened' | 'resolved';
  severity_label: string | null;
  source: string;
  created_at: string;
  updated_at: string | null;
  resolved_at: string | null;
  first_media: IssueMedia | null;
}

interface IssuesResponse {
  unit_id: string;
  issues: PurchaserIssue[];
}

interface PurchaserIssuesTabProps {
  unitUid: string;
  token?: string;
  isDarkMode: boolean;
  onAskAssistant: (question: string) => void;
}

const STATUS_META: Record<
  PurchaserIssue['status'],
  { label: string; hint: string; tone: 'amber' | 'blue' | 'green' | 'neutral' }
> = {
  homeowner_new: {
    label: 'Awaiting review',
    hint: 'The site team has not opened this yet',
    tone: 'amber',
  },
  open: {
    label: 'In progress',
    hint: 'The site team is looking at this',
    tone: 'blue',
  },
  reopened: {
    label: 'Reopened',
    hint: 'You or the team reopened this',
    tone: 'blue',
  },
  resolved: {
    label: 'Resolved',
    hint: 'This has been closed',
    tone: 'green',
  },
};

function severityLabel(s: string | null): string | null {
  if (!s) return null;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = now - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`;
  const wk = Math.round(day / 7);
  return `${wk} wk${wk === 1 ? '' : 's'} ago`;
}

export default function PurchaserIssuesTab({
  unitUid,
  token,
  isDarkMode,
  onAskAssistant,
}: PurchaserIssuesTabProps) {
  const [data, setData] = useState<IssuesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const c = {
    pageBg: isDarkMode ? '#0c0c0c' : '#f7f7f8',
    card: isDarkMode ? '#141414' : '#ffffff',
    cardBorder: isDarkMode ? '#222222' : '#e5e5ea',
    t1: isDarkMode ? '#f5f5f7' : '#111827',
    t2: isDarkMode ? '#a1a1aa' : '#6b7280',
    t3: isDarkMode ? '#71717a' : '#9ca3af',
    amber: '#b45309',
    blue: '#1d4ed8',
    green: '#047857',
  };

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ unitUid });
      if (token) params.set('token', token);
      const res = await fetch(`/api/purchaser/issues?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        setError('Could not load your reported issues.');
        setData({ unit_id: unitUid, issues: [] });
        return;
      }
      const json = (await res.json()) as IssuesResponse;
      setData(json);
    } catch {
      setError('Could not load your reported issues.');
      setData({ unit_id: unitUid, issues: [] });
    } finally {
      setLoading(false);
    }
  }, [unitUid, token]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const issues = data?.issues ?? [];
  const openCount = issues.filter((i) => i.status !== 'resolved').length;
  const newCount = issues.filter((i) => i.status === 'homeowner_new').length;

  const toneStyle = (
    tone: 'amber' | 'blue' | 'green' | 'neutral',
  ): { bg: string; col: string; br: string } => {
    if (isDarkMode) {
      const map = {
        amber: { bg: 'rgba(245,158,11,0.16)', col: '#fbbf24', br: 'rgba(245,158,11,0.30)' },
        blue: { bg: 'rgba(59,130,246,0.16)', col: '#60a5fa', br: 'rgba(59,130,246,0.30)' },
        green: { bg: 'rgba(16,185,129,0.16)', col: '#34d399', br: 'rgba(16,185,129,0.32)' },
        neutral: { bg: 'rgba(161,161,170,0.12)', col: '#a1a1aa', br: 'rgba(161,161,170,0.24)' },
      };
      return map[tone];
    }
    const map = {
      amber: { bg: 'rgba(245,158,11,0.10)', col: c.amber, br: 'rgba(245,158,11,0.28)' },
      blue: { bg: 'rgba(59,130,246,0.10)', col: c.blue, br: 'rgba(59,130,246,0.26)' },
      green: { bg: 'rgba(16,185,129,0.10)', col: c.green, br: 'rgba(16,185,129,0.30)' },
      neutral: { bg: 'rgba(161,161,170,0.08)', col: c.t2, br: 'rgba(161,161,170,0.20)' },
    };
    return map[tone];
  };

  const pillStyle = (tone: 'amber' | 'blue' | 'green' | 'neutral', label: string) => {
    const t = toneStyle(tone);
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: '0.625rem',
          fontWeight: 700,
          padding: '3px 8px',
          borderRadius: 999,
          background: t.bg,
          color: t.col,
          border: `1px solid ${t.br}`,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
    );
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        background: c.pageBg,
        color: c.t1,
        paddingBottom: 'calc(var(--mobile-tab-bar-h, 80px) + 16px)',
      }}
    >
      <div style={{ padding: '18px 16px 0' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2, color: c.t1, margin: 0 }}>
          Issues
        </h1>
        <div style={{ color: c.t2, fontSize: '0.8125rem', marginTop: 4, marginBottom: 18 }}>
          Problems you have reported in your home
        </div>

        {/* Status strip */}
        {!loading && issues.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: isDarkMode ? 'rgba(212,175,55,0.08)' : 'rgba(212,175,55,0.06)',
              border: `1px solid ${toneStyle('amber').br}`,
              borderRadius: 12,
              padding: '11px 14px',
              marginBottom: 14,
            }}
          >
            <Clock size={15} strokeWidth={2} style={{ color: toneStyle('amber').col, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: c.t1, lineHeight: 1.3 }}>
                {openCount === 0
                  ? 'All caught up'
                  : `${openCount} open ${openCount === 1 ? 'issue' : 'issues'}`}
                {newCount > 0 ? ` · ${newCount} awaiting review` : ''}
              </div>
              <div style={{ fontSize: '0.6875rem', color: c.t3, marginTop: 2 }}>
                Reported to your developer
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '0 16px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  height: 72,
                  borderRadius: 12,
                  background: isDarkMode ? '#1a1a1a' : '#f3f4f6',
                  animation: 'pulse 1.6s ease-in-out infinite',
                }}
              />
            ))}
          </div>
        ) : error ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: '40px 0',
              textAlign: 'center',
              color: c.t2,
            }}
          >
            <AlertCircle size={22} strokeWidth={2} style={{ color: c.amber }} />
            <div style={{ fontSize: '0.875rem' }}>{error}</div>
            <button
              type="button"
              onClick={fetchIssues}
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#D4AF37',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 10px',
              }}
            >
              Try again
            </button>
          </div>
        ) : issues.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              padding: '48px 0',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                background: isDarkMode ? '#1b2a1f' : '#ecfdf5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Inbox size={24} strokeWidth={2} style={{ color: c.green }} />
            </div>
            <div style={{ fontSize: '1.0625rem', fontWeight: 600, color: c.t1 }}>
              No issues reported yet
            </div>
            <div style={{ fontSize: '0.8125rem', color: c.t2, maxWidth: 280, lineHeight: 1.5 }}>
              If something is not right, tell the assistant and it will log it for the site team.
            </div>
            <button
              type="button"
              onClick={() =>
                onAskAssistant('I want to report an issue in my home. Can you help me describe it?')
              }
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#1a1408',
                background: 'linear-gradient(180deg,#E0BB44,#D4AF37)',
                border: '1px solid rgba(0,0,0,0.10)',
                borderRadius: 12,
                padding: '10px 16px',
                cursor: 'pointer',
                marginTop: 4,
              }}
            >
              <MessageCircle size={16} strokeWidth={2} />
              Report an issue
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {issues.map((issue) => {
              const meta = STATUS_META[issue.status] ?? STATUS_META.open;
              const sev = severityLabel(issue.severity_label);
              return (
                <div
                  key={issue.id}
                  style={{
                    background: c.card,
                    border: `1px solid ${c.cardBorder}`,
                    borderRadius: 14,
                    padding: 14,
                    boxShadow: isDarkMode
                      ? '0 1px 2px rgba(0,0,0,0.3)'
                      : '0 1px 2px rgba(12,12,12,0.04), 0 8px 20px rgba(12,12,12,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    {/* Thumbnail or icon */}
                    <div style={{ flexShrink: 0 }}>
                      {issue.first_media ? (
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 10,
                            backgroundImage: `url(${issue.first_media.thumbnail_url})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            border: `1px solid ${c.cardBorder}`,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 10,
                            background: issue.status === 'resolved'
                              ? isDarkMode ? '#1b2a1f' : '#ecfdf5'
                              : isDarkMode ? '#2a1f1f' : '#fef3c7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {issue.status === 'resolved' ? (
                            <CheckCircle2 size={20} strokeWidth={2} style={{ color: c.green }} />
                          ) : issue.first_media === null && issue.status === 'homeowner_new' ? (
                            <AlertCircle size={20} strokeWidth={2} style={{ color: toneStyle('amber').col }} />
                          ) : (
                            <ImageIcon size={20} strokeWidth={2} style={{ color: c.t3 }} />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Body */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: c.t1, lineHeight: 1.3 }}>
                        {issue.title}
                      </div>
                      {issue.description && (
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: c.t2,
                            marginTop: 3,
                            lineHeight: 1.4,
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {issue.description}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        {pillStyle(meta.tone, meta.label)}
                        {issue.room && (
                          <span style={{ fontSize: '0.625rem', color: c.t3, fontWeight: 500 }}>
                            {issue.room}
                          </span>
                        )}
                        {sev && issue.status !== 'resolved' && pillStyle('neutral', sev)}
                        <span style={{ fontSize: '0.625rem', color: c.t3, fontWeight: 500, marginLeft: 'auto' }}>
                          {relativeTime(issue.updated_at ?? issue.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Trailing chevron */}
                    <div style={{ flexShrink: 0, paddingTop: 2 }}>
                      <ChevronRight size={16} strokeWidth={2} style={{ color: c.t3 }} />
                    </div>
                  </div>

                  {/* Action hint for new / in-progress */}
                  {issue.status !== 'resolved' && (
                    <button
                      type="button"
                      onClick={() =>
                        onAskAssistant(
                          `You reported "${issue.title}"${issue.room ? ` in the ${issue.room}` : ''}. Can you give me an update?`,
                        )
                      }
                      style={{
                        marginTop: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#D4AF37',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                      }}
                    >
                      <MessageCircle size={14} strokeWidth={2} />
                      Ask about this issue
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.55} }
      `}</style>
    </div>
  );
}
