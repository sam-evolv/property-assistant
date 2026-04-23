'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { MailCheck, Settings2 } from 'lucide-react';
import AgentShell from '../_components/AgentShell';
import DraftsListRow from '../_components/DraftsListRow';
import DraftReviewPanel, { type AutoSendOffer, type SentState } from '../_components/DraftReviewPanel';
import {
  canOfferAutoSend,
  type DraftTypeStats,
} from '@/lib/agent-intelligence/autonomy';
import UndoPill from '../_components/UndoPill';
import { useAgent } from '@/lib/agent/AgentContext';
import { notifyDraftsChanged } from '../_hooks/useDraftsCount';
import type { DraftRecord } from '@/lib/agent-intelligence/drafts';

const AUTO_CLOSE_MS = 3000;

interface UndoBatch {
  batchId: string;
  createdAt: number;
  notice: string | null;
}

export default function AgentDraftsPage() {
  const { agent, alerts } = useAgent();
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeDraft, setActiveDraft] = useState<DraftRecord | null>(null);
  const [sending, setSending] = useState(false);
  const [sentState, setSentState] = useState<SentState | null>(null);
  const [autoSendOffer, setAutoSendOffer] = useState<AutoSendOffer | null>(null);
  const [undoBatch, setUndoBatch] = useState<UndoBatch | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  const pullStartY = useRef<number | null>(null);
  const [pullOffset, setPullOffset] = useState(0);
  const [pulling, setPulling] = useState(false);
  const pullWatchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const loadDrafts = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/intelligence/drafts', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setDrafts(data.drafts || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadDrafts(); }, [loadDrafts]);

  useEffect(() => () => {
    if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
  }, []);

  const handleOpen = (draft: DraftRecord) => {
    setActiveDraft(draft);
    setSentState(null);
  };

  const handleClose = () => {
    if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    setActiveDraft(null);
    setSentState(null);
    setAutoSendOffer(null);
  };

  const closeAfterOffer = useCallback(() => {
    if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    autoCloseTimer.current = setTimeout(() => {
      setActiveDraft(null);
      setSentState(null);
      setAutoSendOffer(null);
    }, 1200);
  }, []);

  const handleEnableAutoSend = useCallback(async (draftType: string) => {
    try {
      await fetch('/api/agent/intelligence/autonomy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftType, autoSendEnabled: true }),
      });
      setAutoSendOffer(null);
      closeAfterOffer();
    } catch {
      alert("Couldn't turn that on. Try from settings.");
    }
  }, [closeAfterOffer]);

  const handleDismissAutoSendOffer = useCallback(async (draftType: string) => {
    try {
      await fetch('/api/agent/intelligence/autonomy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss_offer', draftType }),
      });
    } finally {
      setAutoSendOffer(null);
      closeAfterOffer();
    }
  }, [closeAfterOffer]);

  const handleSave = useCallback(async (
    patch: { subject: string; body: string; sendMethod?: DraftRecord['sendMethod'] },
  ): Promise<DraftRecord | null> => {
    if (!activeDraft) return null;
    const res = await fetch(`/api/agent/intelligence/drafts/${activeDraft.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return null;
    const { draft } = await res.json();
    setActiveDraft(draft);
    setDrafts((prev) => prev.map((d) => (d.id === draft.id ? draft : d)));
    return draft as DraftRecord;
  }, [activeDraft]);

  const handleSend = useCallback(async ({ wasEdited }: { wasEdited: boolean }) => {
    if (!activeDraft) return;
    setSending(true);
    try {
      const res = await fetch('/api/agent/intelligence/send-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: activeDraft.id, wasEdited }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Could not send that draft.');
        return;
      }
      const data = await res.json();
      const newSent: SentState = {
        recipient: activeDraft.recipient.name || 'recipient',
        status: data.status,
        externalHref: data.externalPayload?.href ?? null,
        externalHint: data.externalPayload?.hint ?? null,
        undoable: !!data.undoable,
      };
      setSentState(newSent);
      if (data.externalPayload?.href) {
        window.open(data.externalPayload.href, '_blank', 'noopener');
      }
      setDrafts((prev) => prev.filter((d) => d.id !== activeDraft.id));
      setUndoBatch({ batchId: data.batchId, createdAt: Date.now(), notice: null });
      notifyDraftsChanged();

      // Evaluate the auto-send offer before setting the auto-close timer —
      // if the offer will show, we hold the panel open until the user
      // decides.
      const draftType = activeDraft.draftType;
      let offered = false;
      try {
        const statsRes = await fetch('/api/agent/intelligence/track-record', { cache: 'no-store' });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          const stats: DraftTypeStats | undefined = (statsData.draftTypes || []).find(
            (d: DraftTypeStats) => d.draftType === draftType,
          );
          if (
            stats &&
            canOfferAutoSend(stats, {
              autoSendEnabled: stats.autoSendEnabled,
              offerDismissedCount: stats.offerDismissedCount,
              offeredAt: stats.offeredAt,
              sendsSinceOffer: 0,
            })
          ) {
            setAutoSendOffer({
              draftType: stats.draftType,
              totalSent: stats.totalSent,
              sentEdited: stats.sentEdited,
            });
            offered = true;
          }
        }
      } catch {
        /* non-fatal */
      }

      if (!offered) {
        autoCloseTimer.current = setTimeout(() => {
          setActiveDraft(null);
          setSentState(null);
          setAutoSendOffer(null);
        }, AUTO_CLOSE_MS);
      }
    } finally {
      setSending(false);
    }
  }, [activeDraft]);

  const handleQuickSend = useCallback(async (draft: DraftRecord) => {
    setActiveDraft(draft);
    setSending(true);
    try {
      const res = await fetch('/api/agent/intelligence/send-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: draft.id, wasEdited: false }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Could not send that draft.');
        setActiveDraft(null);
        return;
      }
      const data = await res.json();
      setSentState({
        recipient: draft.recipient.name || 'recipient',
        status: data.status,
        externalHref: data.externalPayload?.href ?? null,
        externalHint: data.externalPayload?.hint ?? null,
        undoable: !!data.undoable,
      });
      if (data.externalPayload?.href) {
        window.open(data.externalPayload.href, '_blank', 'noopener');
      }
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
      setUndoBatch({ batchId: data.batchId, createdAt: Date.now(), notice: null });
      notifyDraftsChanged();
      autoCloseTimer.current = setTimeout(() => {
        setActiveDraft(null);
        setSentState(null);
      }, AUTO_CLOSE_MS);
    } finally {
      setSending(false);
    }
  }, []);

  const handleDiscard = useCallback(async (draft: DraftRecord) => {
    const confirmed = typeof window !== 'undefined'
      ? window.confirm("Discard this draft? This can't be undone.")
      : true;
    if (!confirmed) return;
    const res = await fetch(`/api/agent/intelligence/drafts/${draft.id}`, { method: 'DELETE' });
    if (res.ok) {
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
      if (activeDraft?.id === draft.id) {
        setActiveDraft(null);
        setSentState(null);
      }
      notifyDraftsChanged();
    }
  }, [activeDraft]);

  const handleDiscardFromReview = useCallback(async () => {
    if (!activeDraft) return;
    await handleDiscard(activeDraft);
  }, [activeDraft, handleDiscard]);

  const handleUndoSend = useCallback(async () => {
    if (!undoBatch) return;
    const batch = undoBatch;
    setUndoBatch(null);
    try {
      const res = await fetch('/api/agent/intelligence/undo-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: batch.batchId }),
      });
      const data = await res.json();
      if (data?.notice) {
        alert(data.notice);
      }
      await loadDrafts();
      notifyDraftsChanged();
    } catch {
      alert("Couldn't undo that one — check the drafts list.");
    }
  }, [undoBatch, loadDrafts]);

  // Pull-to-refresh: gentle gesture on mobile only.
  //
  // Bug history: without a `pulling` flag, when the gesture was cancelled
  // by iOS (rubber-band overscroll, vertical scroll takeover, or the user
  // swiping off the edge), `pullOffset` kept its last value and the banner
  // stuck on "Release to refresh" indefinitely. The explicit `pulling` flag
  // plus a touchcancel handler and a watchdog timer ensures the banner
  // always clears.
  const resetPullState = useCallback(() => {
    pullStartY.current = null;
    setPulling(false);
    setPullOffset(0);
    if (pullWatchdog.current) {
      clearTimeout(pullWatchdog.current);
      pullWatchdog.current = null;
    }
  }, []);

  const handlePullStart = (e: React.TouchEvent) => {
    const target = e.currentTarget as HTMLDivElement;
    if (target.scrollTop > 0) return;
    pullStartY.current = e.touches[0].clientY;
    setPulling(true);
  };
  const handlePullMove = (e: React.TouchEvent) => {
    if (pullStartY.current == null) return;
    const delta = e.touches[0].clientY - pullStartY.current;
    if (delta > 0) {
      setPullOffset(Math.min(80, delta));
    } else {
      // Finger moved UP past origin — treat as cancel so we don't show
      // "Release to refresh" when the user has already reversed intent.
      resetPullState();
    }
  };
  const handlePullEnd = async () => {
    const shouldRefresh = pulling && pullOffset > 60;
    // Clear gesture state IMMEDIATELY so the banner transitions straight
    // from "Release to refresh" to "Refreshing..." rather than parking on
    // "Release" while loadDrafts awaits.
    pullStartY.current = null;
    setPulling(false);
    setPullOffset(0);

    if (!shouldRefresh) return;

    setRefreshing(true);
    // Watchdog: loadDrafts is meant to resolve, but if the network stalls
    // we still want the banner to dismiss so the list is usable.
    if (pullWatchdog.current) clearTimeout(pullWatchdog.current);
    pullWatchdog.current = setTimeout(() => setRefreshing(false), 10_000);
    try {
      await loadDrafts();
    } finally {
      if (pullWatchdog.current) {
        clearTimeout(pullWatchdog.current);
        pullWatchdog.current = null;
      }
    }
  };
  const handlePullCancel = () => {
    resetPullState();
  };

  useEffect(() => () => {
    if (pullWatchdog.current) clearTimeout(pullWatchdog.current);
  }, []);

  const content = useMemo(() => {
    if (loading) {
      return (
        <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
          Loading drafts...
        </div>
      );
    }
    if (drafts.length === 0) {
      return <EmptyState />;
    }
    return (
      <div
        data-testid="drafts-list"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '16px 16px 24px',
        }}
      >
        {drafts.map((draft) => (
          <DraftsListRow
            key={draft.id}
            draft={draft}
            onOpen={handleOpen}
            onDiscard={handleDiscard}
            onQuickSend={handleQuickSend}
          />
        ))}
      </div>
    );
  }, [loading, drafts, handleDiscard, handleQuickSend]);

  return (
    <AgentShell agentName={agent?.displayName?.split(' ')[0] || 'Agent'} urgentCount={alerts?.length || 0}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          position: 'relative',
        }}
      >
        <header
          style={{
            padding: '16px 20px 12px',
            borderBottom: '0.5px solid rgba(0,0,0,0.05)',
            background: 'rgba(250,250,248,0.95)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: '#0D0D12',
              }}
            >
              Drafts
            </h1>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: 12.5,
                color: '#9CA3AF',
                letterSpacing: '0.005em',
              }}
            >
              Review what Intelligence wrote for you. Nothing sends until you say so.
            </p>
          </div>
          <Link
            href="/agent/settings/autonomy"
            aria-label="Autonomy settings"
            data-testid="drafts-autonomy-link"
            className="agent-tappable"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              background: 'rgba(0,0,0,0.04)',
              border: '0.5px solid rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6B7280',
              flexShrink: 0,
            }}
          >
            <Settings2 size={16} />
          </Link>
        </header>

        <div
          onTouchStart={handlePullStart}
          onTouchMove={handlePullMove}
          onTouchEnd={handlePullEnd}
          onTouchCancel={handlePullCancel}
          style={{
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {(refreshing || (pulling && pullOffset > 0)) && (
            <div
              style={{
                textAlign: 'center',
                fontSize: 11,
                color: '#9CA3AF',
                padding: refreshing ? '12px 0' : `${pullOffset / 2}px 0`,
              }}
            >
              {refreshing
                ? 'Refreshing...'
                : pullOffset > 60
                  ? 'Release to refresh'
                  : 'Pull to refresh'}
            </div>
          )}
          {content}
        </div>

        {activeDraft && (
          <DraftReviewPanel
            draft={activeDraft}
            surface={isDesktop ? 'desktop' : 'mobile'}
            sending={sending}
            sentState={sentState}
            autoSendOffer={autoSendOffer}
            onClose={handleClose}
            onSave={handleSave}
            onSend={handleSend}
            onDiscard={handleDiscardFromReview}
            onEnableAutoSend={handleEnableAutoSend}
            onDismissAutoSendOffer={handleDismissAutoSendOffer}
          />
        )}

        {undoBatch && (
          <UndoPill
            batchId={undoBatch.batchId}
            createdAt={undoBatch.createdAt}
            onUndo={handleUndoSend}
            onExpire={() => setUndoBatch(null)}
          />
        )}
      </div>
    </AgentShell>
  );
}

function EmptyState() {
  return (
    <div
      data-testid="drafts-empty-state"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '72px 32px',
        gap: 12,
        color: '#9CA3AF',
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: 'rgba(196,155,42,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#C49B2A',
          marginBottom: 8,
        }}
      >
        <MailCheck size={28} />
      </div>
      <p
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: '#0D0D12',
          margin: 0,
          letterSpacing: '-0.01em',
        }}
      >
        No drafts waiting. Nice.
      </p>
      <p
        style={{
          fontSize: 12.5,
          color: '#9CA3AF',
          margin: 0,
          textAlign: 'center',
          maxWidth: 260,
          lineHeight: 1.5,
        }}
      >
        When Intelligence drafts an update for you, it will land here for review.
      </p>
    </div>
  );
}
