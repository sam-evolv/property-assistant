'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import AgentShell from '../_components/AgentShell';
import VoiceInputBar from '../_components/VoiceInputBar';
import VoiceConfirmationCard from '../_components/VoiceConfirmationCard';
import UndoPill from '../_components/UndoPill';
import CapabilityChipsCarousel from '../_components/CapabilityChipsCarousel';
import { useVoiceCapture } from '../_hooks/useVoiceCapture';
import { fetchCapabilityChips } from '@/lib/agent-intelligence/capability-chips';
import { useAgent } from '@/lib/agent/AgentContext';
import { Mail, Copy, Check, ExternalLink } from 'lucide-react';
import type { ExecutedAction, ExtractedAction } from '@/lib/agent-intelligence/voice-actions';
import type { AutoSendUiState } from '../_components/VoiceConfirmationCard';
import { notifyDraftsChanged, useDraftsCount } from '../_hooks/useDraftsCount';
import { ApprovalDrawerProvider, useApprovalDrawer } from '@/lib/agent-intelligence/drawer-store';
import { isAgenticSkillEnvelope } from '@/lib/agent-intelligence/envelope';
import ApprovalDrawer from '@/components/agent/intelligence/ApprovalDrawer';

// Session 7 — the landing-screen action-button grid and the SCHEME_PILLS /
// INDEPENDENT_PILLS 2×2 grid are gone. Capability surfacing is now the
// CapabilityChipsCarousel above the input. The voice-intent flow that
// WRITE_PILLS used to seed still exists — the mic button on the input bar
// opens a voice capture, and the transcript is interpreted the same way.
// The carousel's chip library already includes natural-language equivalents
// ("Log a rental viewing for tomorrow", "Draft a buyer follow-up email",
// etc.) so the workflows remain discoverable.

interface DraftedEmail {
  to: string;
  subject: string;
  body: string;
}

interface VoiceActionsPayload {
  status: 'review' | 'executing' | 'done';
  actions: ExtractedAction[];
  results?: ExecutedAction[];
  transcript?: string;
  autoSendUi?: AutoSendUiState | null;
  globalPaused?: boolean;
  // Session 4B: retry state for sequentially-failed actions.
  batchId?: string;
  sharedContext?: Record<string, unknown>;
  retryingActionIds?: string[];
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  emails?: DraftedEmail[];
  followups?: string[];
  toolsUsed?: Array<{ name: string; summary: string }>;
  voice?: VoiceActionsPayload;
}

interface UndoBatch {
  batchId: string;
  createdAt: number;
}

// Parse <email> blocks from AI response text
function parseEmails(response: string): { emails: DraftedEmail[]; cleanText: string } {
  const emailRegex = /<email>\s*<to>([\s\S]*?)<\/to>\s*<subject>([\s\S]*?)<\/subject>\s*<body>([\s\S]*?)<\/body>\s*<\/email>/g;
  const emails: DraftedEmail[] = [];
  let match;
  while ((match = emailRegex.exec(response)) !== null) {
    emails.push({
      to: match[1].trim(),
      subject: match[2].trim(),
      body: match[3].trim(),
    });
  }

  // Also detect emails in plain-text format (Subject: ... Dear ...)
  if (emails.length === 0) {
    const subjectMatch = response.match(/Subject:\s*(.+?)(?:\n|$)/);
    const dearMatch = response.match(/Dear\s+(\w+)/);
    if (subjectMatch && dearMatch) {
      // Extract the email body starting from "Subject:" to end or next section
      const subjectIdx = response.indexOf('Subject:');
      const bodyText = response.slice(subjectIdx).trim();
      emails.push({
        to: '',
        subject: subjectMatch[1].trim(),
        body: bodyText,
      });
    }
  }

  // Remove email XML blocks from the display text
  const cleanText = response.replace(/<email>[\s\S]*?<\/email>/g, '').trim();

  return { emails, cleanText };
}

export default function IntelligencePage() {
  return (
    <ApprovalDrawerProvider>
      <IntelligencePageInner />
      <ApprovalDrawer />
    </ApprovalDrawerProvider>
  );
}

function IntelligencePageInner() {
  const { agent, alerts, developmentIds } = useAgent();
  const { openApprovalDrawer } = useApprovalDrawer();
  const { count: pendingDraftsCount, ready: draftsReady } = useDraftsCount();
  const searchParams = useSearchParams();
  const router = useRouter();
  const prefillPrompt = searchParams.get('prompt');

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string>(`session_${Date.now()}`);
  const [isDesktop, setIsDesktop] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [undoBatch, setUndoBatch] = useState<UndoBatch | null>(null);
  // Session 11 — live chip list, starts undefined so the carousel
  // uses its fallback set on first paint; the live fetch replaces it.
  const [liveChips, setLiveChips] = useState<string[] | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prefillHandled = useRef(false);
  const inputElRef = useRef<HTMLInputElement | null>(null);
  const voiceIntentRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Session 11 — fetch real-data chips on mount. While the fetch is in
  // flight the carousel uses its fallback set, so first paint is never
  // blank.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const chips = await fetchCapabilityChips();
      if (!cancelled) setLiveChips(chips);
    })();
    return () => { cancelled = true; };
  }, []);

  // Handle prefilled prompt from URL
  useEffect(() => {
    if (prefillPrompt && !prefillHandled.current) {
      prefillHandled.current = true;
      handleSend(prefillPrompt);
    }
  }, [prefillPrompt]);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      // Build history from existing messages
      const history = messages.map(m => ({ role: m.role, content: m.content }));

      const response = await fetch('/api/agent-intelligence/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history,
          sessionId,
          activeDevelopmentId: developmentIds?.[0] || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      // Parse the streaming response token-by-token
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullContent = '';
      let followups: string[] = [];
      let toolsUsed: Array<{ name: string; summary: string }> = [];
      let newSessionId = sessionId;
      const streamingMsgId = (Date.now() + 1).toString();
      let streamingStarted = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.type === 'token') {
              fullContent += data.content;

              // Add or update the streaming message in real time
              if (!streamingStarted) {
                streamingStarted = true;
                setMessages(prev => [...prev, {
                  id: streamingMsgId,
                  role: 'assistant',
                  content: fullContent,
                }]);
              } else {
                setMessages(prev => prev.map(m =>
                  m.id === streamingMsgId ? { ...m, content: fullContent } : m
                ));
              }
            } else if (data.type === 'followups') {
              followups = data.questions || [];
            } else if (data.type === 'tools_used') {
              toolsUsed = data.tools || [];
            } else if (data.type === 'envelope') {
              if (isAgenticSkillEnvelope(data.envelope)) {
                openApprovalDrawer(data.envelope);
                notifyDraftsChanged();
              }
            } else if (data.type === 'override') {
              // Server detected the model hallucinated drafts. Replace
              // whatever tokens have streamed so far with the honest
              // failure message.
              fullContent = typeof data.content === 'string' ? data.content : fullContent;
              if (streamingStarted) {
                setMessages(prev => prev.map(m =>
                  m.id === streamingMsgId ? { ...m, content: fullContent } : m
                ));
              } else {
                streamingStarted = true;
                setMessages(prev => [...prev, {
                  id: streamingMsgId,
                  role: 'assistant',
                  content: fullContent,
                }]);
              }
            } else if (data.type === 'done') {
              newSessionId = data.sessionId || sessionId;
            }
          } catch {
            // Skip malformed lines
          }
        }
      }

      setSessionId(newSessionId);

      // Final update with emails parsed and followups/tools attached
      const { emails, cleanText } = parseEmails(fullContent);

      setMessages(prev => prev.map(m =>
        m.id === streamingMsgId ? {
          ...m,
          content: cleanText || fullContent,
          emails: emails.length > 0 ? emails : undefined,
          followups: followups.length > 0 ? followups : undefined,
          toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
        } : m
      ));
    } catch {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Something went wrong connecting to Intelligence. Check your connection and try again.',
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  }, [messages, isTyping, sessionId, developmentIds, openApprovalDrawer]);

  const handleVoiceTranscript = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return;

    const userMsgId = `user_${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: transcript.trim() },
    ]);

    // Placeholder assistant message while the extractor runs — we flip it into
    // a confirmation card once Claude returns the tool calls.
    const thinkingMsgId = `asst_${Date.now() + 1}`;
    setMessages((prev) => [
      ...prev,
      { id: thinkingMsgId, role: 'assistant', content: '', voice: { status: 'review', actions: [] } },
    ]);
    setIsTyping(true);

    try {
      const res = await fetch('/api/agent/intelligence/extract-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcript.trim(),
          intentHint: voiceIntentRef.current,
          activeDevelopmentId: developmentIds?.[0] || null,
        }),
      });
      voiceIntentRef.current = undefined;

      if (!res.ok) throw new Error('extract failed');
      const data = await res.json();
      const actions: ExtractedAction[] = data.actions || [];

      if (actions.length === 0) {
        // Fall through to the existing typed Intelligence flow so the agent
        // still gets an answer to what they asked.
        setMessages((prev) => prev.filter((m) => m.id !== thinkingMsgId));
        setIsTyping(false);
        await handleSend(transcript.trim());
        return;
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingMsgId
            ? {
                ...m,
                content: '',
                voice: { status: 'review', actions, transcript: transcript.trim() },
              }
            : m,
        ),
      );
    } catch {
      // Session 13 — honest error. We're in the voice path; the
      // transcript itself is the best clue about what happened. If
      // we got here with no transcript, fall back to the generic
      // mic message. If we do have a transcript, surface it so the
      // agent can see what Whisper heard and whether the misheard
      // word is what's tripping them up.
      const hadTranscript = !!transcript.trim();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingMsgId
            ? {
                ...m,
                content: hadTranscript
                  ? `I heard "${transcript.trim()}" but I'm not sure what you'd like me to do. Try again?`
                  : "I couldn't catch that. Tap the mic and try again?",
                voice: undefined,
              }
            : m,
        ),
      );
    } finally {
      setIsTyping(false);
    }
  }, [developmentIds, handleSend]);

  const voice = useVoiceCapture({ onTranscriptReady: handleVoiceTranscript });

  const updateVoiceMessage = useCallback(
    (msgId: string, updater: (v: VoiceActionsPayload) => VoiceActionsPayload) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId && m.voice ? { ...m, voice: updater(m.voice) } : m,
        ),
      );
    },
    [],
  );

  const handleVoiceActionsChange = useCallback(
    (msgId: string, actions: ExtractedAction[]) => {
      updateVoiceMessage(msgId, (v) => ({ ...v, actions }));
    },
    [updateVoiceMessage],
  );

  const handleDiscard = useCallback(
    (msgId: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    },
    [],
  );

  const handleApprove = useCallback(
    async (msgId: string) => {
      const msg = messages.find((m) => m.id === msgId);
      if (!msg?.voice) return;
      const actions = msg.voice.actions;
      updateVoiceMessage(msgId, (v) => ({ ...v, status: 'executing' }));

      try {
        const res = await fetch('/api/agent/intelligence/execute-actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actions, transcript: msg.voice.transcript }),
        });

        if (!res.ok) throw new Error('execute failed');
        const data = await res.json();
        const results: ExecutedAction[] = data.results || [];
        const batchId: string = data.batchId;
        const globalPaused: boolean = !!data.globalPaused;

        // If any action came back with an auto-send plan, set up the countdown
        // state. Only one auto-send plan at a time is supported — the spec
        // narrows Session 3 to draft_vendor_update, and a transcript produces
        // at most one of those.
        const autoSendAction = results.find((r) => r.autoSendPlan);
        let autoSendUi: AutoSendUiState | null = null;
        if (autoSendAction?.autoSendPlan) {
          autoSendUi = {
            actionId: autoSendAction.id,
            draftId: autoSendAction.autoSendPlan.draftId,
            draftType: autoSendAction.autoSendPlan.draftType,
            recipientName: autoSendAction.autoSendPlan.recipientName,
            countdownSeconds: autoSendAction.autoSendPlan.countdownSeconds,
            active: true,
            status: 'counting',
          };
        }

        updateVoiceMessage(msgId, (v) => ({
          ...v,
          status: 'done',
          results,
          autoSendUi,
          globalPaused,
          batchId,
          sharedContext: data.sharedContext,
        }));

        // Natural-language confirmation below the card — but only for actions
        // that actually completed. Auto-send actions haven't finished yet.
        const summary = buildConfirmationSummary(actions, results, autoSendUi);
        if (summary) {
          setMessages((prev) => [
            ...prev,
            {
              id: `asst_confirm_${Date.now()}`,
              role: 'assistant',
              content: summary,
            },
          ]);
        }

        if (autoSendUi) {
          // Track the approval batch so the Session 1 undo also covers the
          // draft insertion. The auto-send itself gets a separate undo batch
          // once the send actually fires.
          if (results.filter((r) => !r.autoSendPlan).some((r) => r.success)) {
            setUndoBatch({ batchId, createdAt: Date.now() });
          }
        } else if (results.some((r) => r.success)) {
          setUndoBatch({ batchId, createdAt: Date.now() });
        }

        if (results.some((r) => r.type === 'draft_vendor_update')) {
          notifyDraftsChanged();
        }
      } catch {
        updateVoiceMessage(msgId, (v) => ({ ...v, status: 'review' }));
        setMessages((prev) => [
          ...prev,
          {
            id: `asst_err_${Date.now()}`,
            role: 'assistant',
            content: "Couldn't log those just now. Try again in a second?",
          },
        ]);
      }
    },
    [messages, updateVoiceMessage],
  );

  const handleRetryAction = useCallback(
    async (msgId: string, actionId: string) => {
      const msg = messages.find((m) => m.id === msgId);
      if (!msg?.voice) return;
      const action = msg.voice.actions.find((a) => a.id === actionId);
      if (!action) return;

      updateVoiceMessage(msgId, (v) => ({
        ...v,
        retryingActionIds: [...(v.retryingActionIds || []), actionId],
      }));

      try {
        const res = await fetch('/api/agent/intelligence/execute-actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actions: [action],
            batchId: msg.voice.batchId,
            sharedContext: msg.voice.sharedContext,
          }),
        });
        if (!res.ok) throw new Error('retry failed');
        const data = await res.json();
        const retryResult: ExecutedAction | undefined = (data.results || [])[0];
        if (!retryResult) throw new Error('no_result');

        updateVoiceMessage(msgId, (v) => ({
          ...v,
          results: (v.results || []).map((r) => (r.id === actionId ? retryResult : r)),
          sharedContext: data.sharedContext || v.sharedContext,
          retryingActionIds: (v.retryingActionIds || []).filter((id) => id !== actionId),
        }));

        if (retryResult.success && retryResult.type === 'draft_application_invitation') {
          notifyDraftsChanged();
        }
      } catch {
        updateVoiceMessage(msgId, (v) => ({
          ...v,
          retryingActionIds: (v.retryingActionIds || []).filter((id) => id !== actionId),
        }));
      }
    },
    [messages, updateVoiceMessage],
  );

  const handleAutoSendElapsed = useCallback(
    async (msgId: string) => {
      const msg = messages.find((m) => m.id === msgId);
      const ui = msg?.voice?.autoSendUi;
      if (!ui || ui.status !== 'counting') return;
      updateVoiceMessage(msgId, (v) => ({
        ...v,
        autoSendUi: v.autoSendUi ? { ...v.autoSendUi, status: 'sending' } : v.autoSendUi,
      }));
      try {
        const res = await fetch('/api/agent/intelligence/send-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draftId: ui.draftId,
            wasEdited: false,
            mode: 'auto_sent',
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          updateVoiceMessage(msgId, (v) => ({
            ...v,
            autoSendUi: v.autoSendUi
              ? {
                  ...v.autoSendUi,
                  status: 'failed',
                  active: false,
                  failMessage: err.holdCopy || err.error || "Couldn't auto-send — the draft is in review.",
                }
              : v.autoSendUi,
          }));
          notifyDraftsChanged();
          return;
        }
        const data = await res.json();
        updateVoiceMessage(msgId, (v) => ({
          ...v,
          autoSendUi: v.autoSendUi ? { ...v.autoSendUi, status: 'sent', active: false } : v.autoSendUi,
        }));
        if (data.batchId) {
          setUndoBatch({ batchId: data.batchId, createdAt: Date.now() });
        }
        notifyDraftsChanged();
      } catch {
        updateVoiceMessage(msgId, (v) => ({
          ...v,
          autoSendUi: v.autoSendUi
            ? { ...v.autoSendUi, status: 'failed', active: false, failMessage: "Couldn't auto-send — the draft is in review." }
            : v.autoSendUi,
        }));
        notifyDraftsChanged();
      }
    },
    [messages, updateVoiceMessage],
  );

  const handleAutoSendCancel = useCallback(
    async (msgId: string) => {
      const msg = messages.find((m) => m.id === msgId);
      const ui = msg?.voice?.autoSendUi;
      if (!ui || ui.status !== 'counting') return;
      updateVoiceMessage(msgId, (v) => ({
        ...v,
        autoSendUi: v.autoSendUi ? { ...v.autoSendUi, status: 'cancelled', active: false } : v.autoSendUi,
      }));
      try {
        await fetch('/api/agent/intelligence/cancel-auto-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draftId: ui.draftId }),
        });
        notifyDraftsChanged();
      } catch {
        /* best-effort — the UI already shows cancelled */
      }
    },
    [messages, updateVoiceMessage],
  );

  const handleUndo = useCallback(async () => {
    if (!undoBatch) return;
    const batch = undoBatch;
    setUndoBatch(null);
    try {
      await fetch('/api/agent/intelligence/undo-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: batch.batchId }),
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `asst_undo_${Date.now()}`,
          role: 'assistant',
          content: "Rolled back. Nothing was sent.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `asst_undo_err_${Date.now()}`,
          role: 'assistant',
          content: "Couldn't undo that. You'll need to clean it up manually.",
        },
      ]);
    }
  }, [undoBatch]);

  // Session 7 — chip taps prefill the input + focus it. They never
  // auto-submit; the agent reviews and edits before sending.
  const handleChipTap = useCallback((text: string) => {
    setInput(text);
    // Next tick: give the controlled input time to update before we
    // focus + move cursor to the end.
    requestAnimationFrame(() => {
      const el = inputElRef.current;
      if (!el) return;
      el.focus();
      try {
        el.setSelectionRange(text.length, text.length);
      } catch { /* some browsers don't support setSelectionRange on type=text */ }
    });
  }, []);

  const hasMessages = messages.length > 0;
  const firstName = agent?.displayName?.split(' ')[0] || 'Agent';

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
        {!hasMessages ? (
          /* Landing state — Session 7 rebuild.
             Layout is a 3-row flex column:
               1. Hero block (top) — fixed position from first paint
               2. Flexible spacer — pushes chips + input toward the input bar
               3. Chip carousel (above the input)
             The drafts banner has a reserved min-height container so when
             count resolves from 0 → N (or stays 0), nothing else shifts. */
          <div
            data-testid="intelligence-landing"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '0 24px',
              textAlign: 'center',
              background:
                'radial-gradient(ellipse 90% 55% at 50% 22%, rgba(196,155,42,0.05) 0%, transparent 70%)',
              minHeight: 0,
            }}
          >
            {/* Breathing room from the status bar. */}
            <div style={{ height: 24, flexShrink: 0 }} />

            {/* Session 11 restored, Session 12 enlarged — OPENHOUSE
                logo centred above the hero. 80×80 on mobile, 96×96 on
                desktop. Always rendered regardless of drafts state. */}
            <Image
              src="/oh-logo.png"
              alt="OpenHouse"
              width={isDesktop ? 96 : 80}
              height={isDesktop ? 96 : 80}
              priority
              style={{
                objectFit: 'contain',
                display: 'block',
                mixBlendMode: 'multiply',
                marginBottom: 32,
              }}
            />

            <h1
              data-testid="intelligence-hero"
              style={{
                color: '#0b0c0f',
                fontSize: 26,
                fontWeight: 600,
                letterSpacing: '-0.025em',
                lineHeight: 1.2,
                margin: 0,
                maxWidth: 320,
              }}
            >
              What can I help with, {firstName}?
            </h1>

            <div style={{ height: 18, flexShrink: 0 }} />

            <p
              style={{
                color: '#6B7280',
                fontSize: 14,
                lineHeight: 1.5,
                margin: 0,
                maxWidth: 300,
                letterSpacing: '0.005em',
              }}
            >
              Voice or text. I&rsquo;ll show you what I drafted before sending.
            </p>

            {/* Session 11 — quiet drafts link.
                Single muted line under the helper sentence; only
                rendered when count resolves to > 0. 20px reserved so
                the chip carousel doesn't shift when the link appears
                or disappears. The FAB badge already shows the count. */}
            <div
              style={{
                marginTop: 12,
                minHeight: 20,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                maxWidth: 360,
              }}
            >
              {draftsReady && pendingDraftsCount > 0 ? (
                <button
                  type="button"
                  data-testid="intelligence-drafts-link"
                  onClick={() => router.push('/agent/drafts')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    color: '#6B7280',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    textDecoration: 'underline',
                    textUnderlineOffset: 3,
                    cursor: 'pointer',
                  }}
                >
                  {pendingDraftsCount} draft{pendingDraftsCount === 1 ? '' : 's'} waiting in your inbox
                </button>
              ) : null}
            </div>

            {/* Flex spacer — pushes chips down toward the input bar. */}
            <div style={{ flex: 1, minHeight: 24 }} />

            <CapabilityChipsCarousel
              onChipTap={handleChipTap}
              paused={inputFocused}
              chips={liveChips}
            />

            <div style={{ height: 16, flexShrink: 0 }} />
          </div>
        ) : (
          /* Conversation state */
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              scrollbarWidth: 'none',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
            className="[&::-webkit-scrollbar]:hidden"
          >
            {messages.map(msg => {
              if (msg.role === 'user') {
                return <UserBubble key={msg.id} text={msg.content} />;
              }
              if (msg.voice) {
                return (
                  <VoiceConfirmationCard
                    key={msg.id}
                    actions={msg.voice.actions}
                    status={msg.voice.status}
                    results={msg.voice.results}
                    autoSendUi={msg.voice.autoSendUi}
                    globalPaused={msg.voice.globalPaused}
                    retryingIds={msg.voice.retryingActionIds}
                    onChange={(next) => handleVoiceActionsChange(msg.id, next)}
                    onApprove={() => handleApprove(msg.id)}
                    onDiscard={() => handleDiscard(msg.id)}
                    onAutoSendElapsed={() => handleAutoSendElapsed(msg.id)}
                    onAutoSendCancel={() => handleAutoSendCancel(msg.id)}
                    onRetryAction={(actionId) => handleRetryAction(msg.id, actionId)}
                  />
                );
              }
              return (
                <AIResponseCard
                  key={msg.id}
                  text={msg.content}
                  emails={msg.emails}
                  followups={msg.followups}
                  onFollowup={handleSend}
                />
              );
            })}
            {isTyping && <TypingIndicator />}
          </div>
        )}

        <VoiceInputBar
          ref={inputElRef}
          input={input}
          onInputChange={setInput}
          onSend={() => handleSend(input)}
          isTyping={isTyping}
          voice={voice}
          onStart={() => voice.start()}
          onStop={() => voice.stop()}
          isDesktop={isDesktop}
          onOpenSettings={voice.openSettings}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
        />

        {undoBatch && (
          <UndoPill
            batchId={undoBatch.batchId}
            createdAt={undoBatch.createdAt}
            onUndo={handleUndo}
            onExpire={() => setUndoBatch(null)}
          />
        )}
      </div>
    </AgentShell>
  );
}

function buildConfirmationSummary(
  actions: ExtractedAction[],
  results: ExecutedAction[],
  autoSendUi: AutoSendUiState | null,
): string | null {
  const okById: Record<string, boolean> = {};
  const resultById: Record<string, ExecutedAction> = {};
  results.forEach((r) => {
    okById[r.id] = r.success;
    resultById[r.id] = r;
  });

  const clauses: string[] = [];
  for (const a of actions) {
    if (!okById[a.id]) continue;
    // Skip auto-send actions — their confirmation sentence fires from the
    // countdown banner, not this summary line.
    if (autoSendUi && autoSendUi.actionId === a.id) continue;

    const result = resultById[a.id];

    if (a.type === 'log_viewing') {
      clauses.push(`logged the viewing for ${a.fields.property_id || 'the property'}`);
    } else if (a.type === 'draft_vendor_update') {
      clauses.push('drafted the vendor update for you to review');
    } else if (a.type === 'draft_viewing_followup_buyer') {
      const name = a.fields.recipient_id || 'the buyer';
      clauses.push(`drafted the viewing follow-up for ${name}`);
    } else if (a.type === 'draft_offer_response') {
      const kind: string = a.fields.action || 'acknowledge';
      const name = a.fields.recipient_id || 'the buyer';
      if (kind === 'counter') {
        const amount = typeof a.fields.counter_amount === 'number'
          ? ` at €${Math.round(a.fields.counter_amount).toLocaleString('en-IE')}`
          : '';
        clauses.push(`drafted the counter-offer${amount} for ${name}`);
      } else if (kind === 'accept') {
        clauses.push(`drafted the offer acceptance for ${name}`);
      } else if (kind === 'reject') {
        clauses.push(`drafted the offer decline for ${name}`);
      } else {
        clauses.push(`drafted the offer acknowledgement for ${name}`);
      }
    } else if (a.type === 'draft_price_reduction_notice') {
      const count = result?.recipientCount ?? (Array.isArray(a.fields.recipient_ids) ? a.fields.recipient_ids.length : 0);
      clauses.push(
        count === 1
          ? 'drafted the price reduction notice for 1 buyer'
          : `drafted the price reduction notice for ${count} buyers`,
      );
    } else if (a.type === 'draft_chain_update_to_buyer') {
      const name = a.fields.buyer_id || 'the buyer';
      clauses.push(`drafted the chain update for ${name}`);
    } else if (a.type === 'log_rental_viewing') {
      const property = a.fields.letting_property_id || 'the property';
      clauses.push(`logged the rental viewing at ${property}`);
    } else if (a.type === 'create_applicant') {
      const name = a.fields.full_name || 'a new applicant';
      clauses.push(`added ${name} to applicants`);
    } else if (a.type === 'flag_applicant_preferred') {
      const name = a.fields.applicant_name || 'the applicant';
      clauses.push(`flagged ${name} as preferred`);
    } else if (a.type === 'draft_application_invitation') {
      const name = a.fields.applicant_name || 'the applicant';
      clauses.push(`drafted the application invitation for ${name}`);
    } else if (a.type === 'create_reminder') {
      const due = a.fields.due_date ? formatReminder(a.fields.due_date) : '';
      clauses.push(due ? `set a reminder for ${due}` : 'set a reminder');
    }
  }

  const failures = results.filter((r) => !r.success);
  if (clauses.length === 0 && failures.length === 0) {
    // Auto-send is the only action. Summary is redundant — the countdown
    // banner speaks for itself.
    return null;
  }

  const core = clauses.length ? `Done. I've ${joinClauses(clauses)}.` : 'Done.';
  if (failures.length > 0) {
    return `${core} One or two items didn't save, have a look above.`;
  }
  return core;
}

function joinClauses(clauses: string[]): string {
  if (clauses.length === 1) return clauses[0];
  if (clauses.length === 2) return `${clauses[0]}, and ${clauses[1]}`;
  return `${clauses.slice(0, -1).join(', ')}, and ${clauses[clauses.length - 1]}`;
}

function formatReminder(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IE', { weekday: 'long' });
  } catch {
    return '';
  }
}

/* ---- Sub-components ---- */

function UserBubble({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div
        style={{
          background: 'linear-gradient(135deg, #C49B2A, #E8C84A)',
          borderRadius: '20px 20px 4px 20px',
          padding: '12px 16px',
          maxWidth: '82%',
          boxShadow:
            '0 4px 16px rgba(196,155,42,0.30), 0 1px 4px rgba(196,155,42,0.20)',
        }}
      >
        <p
          style={{
            color: '#fff',
            fontSize: 14,
            lineHeight: 1.5,
            margin: 0,
            fontWeight: 500,
            letterSpacing: '-0.01em',
            textShadow: '0 1px 2px rgba(0,0,0,0.1)',
          }}
        >
          {text}
        </p>
      </div>
    </div>
  );
}

function AIResponseCard({
  text,
  emails,
  followups,
  onFollowup,
}: {
  text: string;
  emails?: DraftedEmail[];
  followups?: string[];
  onFollowup: (text: string) => void;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 18,
          padding: '16px',
          maxWidth: '90%',
          boxShadow:
            '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
          width: '100%',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <Image
            src="/oh-logo.png"
            alt=""
            width={24}
            height={24}
            style={{
              objectFit: 'contain',
              mixBlendMode: 'multiply',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#0D0D12',
              letterSpacing: '-0.01em',
            }}
          >
            Intelligence
          </span>
        </div>

        {/* Response text */}
        {text && (
          <div
            style={{
              fontSize: 13.5,
              lineHeight: 1.6,
              color: '#374151',
              letterSpacing: '-0.005em',
              whiteSpace: 'pre-wrap',
            }}
          >
            {text}
          </div>
        )}

        {/* Email draft cards */}
        {emails && emails.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: text ? 16 : 0 }}>
            {emails.map((email, i) => (
              <EmailDraftCard key={i} email={email} index={i + 1} total={emails.length} />
            ))}
          </div>
        )}

        {/* Follow-up suggestion chips */}
        {followups && followups.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 16,
              paddingTop: 12,
              borderTop: '1px solid rgba(0,0,0,0.05)',
            }}
          >
            {followups.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => onFollowup(suggestion)}
                className="agent-tappable"
                style={{
                  padding: '8px 14px',
                  background: '#FAFAF8',
                  border: '0.5px solid rgba(0,0,0,0.08)',
                  borderRadius: 20,
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: '#6B7280',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  lineHeight: 1.3,
                  transition: 'all 0.15s ease',
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmailDraftCard({ email, index, total }: { email: DraftedEmail; index: number; total: number }) {
  const [copied, setCopied] = useState(false);

  const fullEmailText = email.subject
    ? `Subject: ${email.subject}\n\n${email.body}`
    : email.body;

  const handleSendViaGmail = () => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email.to)}&su=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
    window.open(gmailUrl, '_blank');
  };

  const handleSendViaMailto = () => {
    const mailtoUrl = `mailto:${email.to}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
    window.location.href = mailtoUrl;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullEmailText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = fullEmailText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      style={{
        background: '#FAFAF8',
        borderRadius: 14,
        border: '0.5px solid rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}
    >
      {/* Email header */}
      <div style={{ padding: '12px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Mail size={13} color="#D4AF37" />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Draft {total > 1 ? `${index}/${total}` : ''}
            </span>
          </div>
        </div>
        {email.to && (
          <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 2 }}>
            To: {email.to}
          </div>
        )}
        {email.subject && (
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0D0D12', letterSpacing: '-0.01em' }}>
            {email.subject}
          </div>
        )}
      </div>

      {/* Email body */}
      <div
        style={{
          padding: '12px 14px',
          fontSize: 13,
          lineHeight: 1.6,
          color: '#374151',
          whiteSpace: 'pre-wrap',
          maxHeight: 200,
          overflowY: 'auto',
        }}
      >
        {email.body}
      </div>

      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '10px 14px',
          borderTop: '0.5px solid rgba(0,0,0,0.05)',
        }}
      >
        <button
          onClick={handleSendViaGmail}
          className="agent-tappable"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '10px 12px',
            background: '#0D0D12',
            border: 'none',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 600,
            color: '#fff',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <ExternalLink size={13} />
          Send via Gmail
        </button>
        <button
          onClick={handleSendViaMailto}
          className="agent-tappable"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '10px 12px',
            background: '#fff',
            border: '0.5px solid rgba(0,0,0,0.1)',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 600,
            color: '#374151',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Mail size={13} />
          Mail App
        </button>
        <button
          onClick={handleCopy}
          className="agent-tappable"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 14px',
            background: '#fff',
            border: '0.5px solid rgba(0,0,0,0.1)',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 600,
            color: copied ? '#059669' : '#374151',
            cursor: 'pointer',
            fontFamily: 'inherit',
            gap: 6,
            transition: 'color 0.15s ease',
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 18,
          padding: '16px',
          boxShadow:
            '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05), 0 0 0 0.5px rgba(0,0,0,0.04)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Image
          src="/oh-logo.png"
          alt=""
          width={24}
          height={24}
          style={{
            objectFit: 'contain',
            mixBlendMode: 'multiply',
            flexShrink: 0,
          }}
        />
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: '#C0C8D4',
                animation: `intelligence-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
        <style>{`
          @keyframes intelligence-pulse {
            0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
            40% { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>
    </div>
  );
}
