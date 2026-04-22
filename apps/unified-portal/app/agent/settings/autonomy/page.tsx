'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, PauseCircle } from 'lucide-react';
import AgentShell from '../../_components/AgentShell';
import { useAgent } from '@/lib/agent/AgentContext';
import { draftTypeLabel } from '@/lib/agent-intelligence/drafts';
import { ELIGIBILITY_RULES, type DraftTypeStats } from '@/lib/agent-intelligence/autonomy';

interface Payload {
  draftTypes: DraftTypeStats[];
  globalPaused: boolean;
}

export default function AutonomySettingsPage() {
  const { agent, alerts } = useAgent();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/intelligence/track-record', { cache: 'no-store' });
      if (!res.ok) return;
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleType = async (draftType: string, nextEnabled: boolean) => {
    setSaving(draftType);
    try {
      await fetch('/api/agent/intelligence/autonomy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftType, autoSendEnabled: nextEnabled }),
      });
      await load();
    } finally {
      setSaving(null);
    }
  };

  const toggleGlobalPause = async (paused: boolean) => {
    setSaving('_global_pause');
    try {
      await fetch('/api/agent/intelligence/autonomy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ globalPaused: paused }),
      });
      await load();
    } finally {
      setSaving(null);
    }
  };

  return (
    <AgentShell agentName={agent?.displayName?.split(' ')[0] || 'Agent'} urgentCount={alerts?.length || 0}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
        }}
      >
        <header
          style={{
            padding: '14px 16px 12px',
            borderBottom: '0.5px solid rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Link
            href="/agent/drafts"
            aria-label="Back"
            className="agent-tappable"
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0D0D12',
              background: 'transparent',
              border: 'none',
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: '#0D0D12',
              }}
            >
              Auto-send
            </h1>
            <p
              style={{
                margin: '2px 0 0',
                fontSize: 11.5,
                color: '#9CA3AF',
                letterSpacing: '0.005em',
              }}
            >
              Your autonomy settings. Change at any time.
            </p>
          </div>
        </header>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '16px 16px 32px',
          }}
        >
          <p
            style={{
              margin: '0 0 18px',
              fontSize: 13.5,
              lineHeight: 1.55,
              color: '#374151',
              letterSpacing: '0.005em',
            }}
          >
            Some things are worth doing by hand. Some things aren&apos;t. You decide
            which is which. Every auto-sent message still gives you 10 seconds to
            stop it, and 60 more to pull it back after it goes.
          </p>

          {data && (
            <GlobalPauseRow
              paused={data.globalPaused}
              saving={saving === '_global_pause'}
              onChange={toggleGlobalPause}
            />
          )}

          {loading && (
            <p style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: 32 }}>
              Loading...
            </p>
          )}

          {data && data.draftTypes.length === 0 && !loading && (
            <div
              data-testid="autonomy-empty-state"
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#9CA3AF',
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              Nothing to configure yet. Auto-send rows appear once you&apos;ve sent a
              draft of a given type.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(data?.draftTypes || []).map((stats) => (
              <AutonomyRow
                key={stats.draftType}
                stats={stats}
                saving={saving === stats.draftType}
                onChange={toggleType}
              />
            ))}
          </div>
        </div>
      </div>
    </AgentShell>
  );
}

function GlobalPauseRow({
  paused,
  saving,
  onChange,
}: {
  paused: boolean;
  saving: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div
      data-testid="autonomy-global-pause-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        marginBottom: 16,
        borderRadius: 14,
        background: paused ? 'rgba(220,38,38,0.05)' : '#FFFFFF',
        border: paused ? '0.5px solid rgba(220,38,38,0.2)' : '0.5px solid rgba(0,0,0,0.06)',
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          background: paused ? 'rgba(220,38,38,0.1)' : 'rgba(0,0,0,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: paused ? '#DC2626' : '#6B7280',
          flexShrink: 0,
        }}
      >
        <PauseCircle size={18} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0D0D12' }}>Pause all auto-send</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
          {paused
            ? 'Auto-send is paused. Everything drops to drafts for review.'
            : 'Kill switch. Flip on to hold every message for review.'}
        </div>
      </div>
      <Toggle
        checked={paused}
        disabled={saving}
        onChange={onChange}
        testId="autonomy-global-pause-toggle"
      />
    </div>
  );
}

function AutonomyRow({
  stats,
  saving,
  onChange,
}: {
  stats: DraftTypeStats;
  saving: boolean;
  onChange: (draftType: string, next: boolean) => void;
}) {
  const enabled = stats.autoSendEnabled;
  const canToggle = !stats.statutory && (stats.eligibleForAutoSend || enabled);
  const trackSummary = `${stats.totalSent} sent, ${stats.sentAsGenerated} without edits, ${stats.undoneCount} undone`;

  let pill: { label: string; tone: 'gold' | 'neutral' | 'muted' };
  if (stats.statutory) {
    pill = { label: 'Review only', tone: 'muted' };
  } else if (enabled) {
    pill = { label: 'On', tone: 'gold' };
  } else if (stats.eligibleForAutoSend) {
    pill = { label: 'Eligible', tone: 'neutral' };
  } else {
    pill = { label: 'Building up', tone: 'muted' };
  }

  const remaining = Math.max(0, ELIGIBILITY_RULES.minTotalSent - stats.sentAsGenerated);
  const buildingUpCopy =
    !stats.statutory && !stats.eligibleForAutoSend && !enabled && remaining > 0
      ? `Need ${remaining} more send${remaining === 1 ? '' : 's'} without edits to unlock.`
      : stats.eligibilityMessage;

  return (
    <div
      data-testid={`autonomy-row-${stats.draftType}`}
      style={{
        background: '#FFFFFF',
        borderRadius: 14,
        padding: '14px 16px',
        border: '0.5px solid rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#0D0D12',
              letterSpacing: '-0.01em',
              marginBottom: 2,
            }}
          >
            {draftTypeLabel(stats.draftType)}s
          </div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>{trackSummary}</div>
        </div>
        <StatusPill pill={pill} statutory={stats.statutory} />
      </div>

      {buildingUpCopy && (
        <div style={{ fontSize: 11.5, color: '#9CA3AF', lineHeight: 1.5 }}>
          {buildingUpCopy}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Toggle
          checked={enabled}
          disabled={!canToggle || saving}
          onChange={(next) => onChange(stats.draftType, next)}
          testId={`autonomy-toggle-${stats.draftType}`}
        />
      </div>
    </div>
  );
}

function StatusPill({
  pill,
  statutory,
}: {
  pill: { label: string; tone: 'gold' | 'neutral' | 'muted' };
  statutory: boolean;
}) {
  const tone = pill.tone;
  const palette =
    tone === 'gold'
      ? { bg: 'linear-gradient(135deg, #C49B2A, #E8C84A)', color: '#fff' }
      : tone === 'neutral'
        ? { bg: 'rgba(13,13,18,0.06)', color: '#0D0D12' }
        : { bg: 'rgba(0,0,0,0.04)', color: '#9CA3AF' };

  return (
    <span
      title={statutory ? 'Statutory documents always require your review' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: 999,
        background: palette.bg,
        color: palette.color,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.02em',
      }}
    >
      {pill.label}
    </span>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
  testId,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        width: 46,
        height: 28,
        borderRadius: 14,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked
          ? 'linear-gradient(135deg, #C49B2A, #E8C84A)'
          : 'rgba(0,0,0,0.1)',
        opacity: disabled ? 0.45 : 1,
        transition: 'background 0.15s ease',
        padding: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 21 : 3,
          width: 22,
          height: 22,
          borderRadius: 11,
          background: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 0.15s cubic-bezier(0.22,0.8,0.2,1)',
        }}
      />
    </button>
  );
}
