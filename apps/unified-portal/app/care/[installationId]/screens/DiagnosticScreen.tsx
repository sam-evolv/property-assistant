'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCareApp } from '../care-app-provider';

/* ══════════════════════════════════════════════════════════
   Types & Data
   ══════════════════════════════════════════════════════════ */

type DiagnosticView =
  | 'issues'
  | 'step-1'
  | 'step-2'
  | 'generic-flow'
  | 'resolved'
  | 'escalated';

interface IssueCard {
  id: string;
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  description: string;
  flowId?: string;
}

interface DiagnosticFlow {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  colour: string | null;
  steps: DiagnosticStep[];
}

interface DiagnosticStep {
  id: string;
  type: 'yes_no' | 'multiple_choice' | 'escalate' | 'info' | 'redirect';
  title: string;
  body?: string;
  yes_next?: string;
  no_next?: string;
  yes_action?: string;
  no_action?: string;
  options?: Array<{ label: string; next?: string; action?: string }>;
  next?: string;
}

/* ══════════════════════════════════════════════════════════
   Issue Icons (inline SVG)
   ══════════════════════════════════════════════════════════ */

const ErrorLightIcon = (
  <svg
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="#EF4444"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const NoPowerIcon = (
  <svg
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="#F59E0B"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

const ControlsIcon = (
  <svg
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="#3B82F6"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const NoiseIcon = (
  <svg
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="#8B5CF6"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

const BillIcon = (
  <svg
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="#10B981"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 8.5A6.5 6.5 0 0 0 7 10.5v3a6.5 6.5 0 0 0 11 2" />
    <line x1="4" y1="10" x2="14" y2="10" />
    <line x1="4" y1="14" x2="14" y2="14" />
  </svg>
);

const ISSUES: IssueCard[] = [
  {
    id: 'error-light',
    title: 'Error Light on Inverter',
    icon: ErrorLightIcon,
    iconBg: '#FEF2F2',
    description: 'Red or amber LED is showing on the inverter unit',
  },
  {
    id: 'no-power',
    title: 'No Power Generating',
    icon: NoPowerIcon,
    iconBg: '#FFFBEB',
    description: 'System appears to not be producing any energy',
  },
  {
    id: 'controls',
    title: 'Controls Not Responding',
    icon: ControlsIcon,
    iconBg: '#EFF6FF',
    description: 'Monitoring app or display not showing data',
  },
  {
    id: 'noise',
    title: 'Unusual Noise',
    icon: NoiseIcon,
    iconBg: '#F5F3FF',
    description: 'Buzzing, clicking, or other unusual sounds',
  },
  {
    id: 'bill',
    title: 'Energy Bill Seems High',
    icon: BillIcon,
    iconBg: '#ECFDF5',
    description: 'Electricity bill higher than expected with solar',
  },
];

/* ══════════════════════════════════════════════════════════
   Main DiagnosticScreen
   ══════════════════════════════════════════════════════════ */

export default function DiagnosticScreen() {
  const { installation, installationId, setActiveTab } = useCareApp();
  const [view, setView] = useState<DiagnosticView>('issues');
  const [mounted, setMounted] = useState(false);
  const [isolatorOn, setIsolatorOn] = useState(false);
  const [dbFlows, setDbFlows] = useState<DiagnosticFlow[]>([]);
  const [activeFlow, setActiveFlow] = useState<DiagnosticFlow | null>(null);
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [stepsCompleted, setStepsCompleted] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
    const fetchFlows = async () => {
      try {
        const res = await fetch(`/api/care/diagnostic/flows?installation_id=${installationId}`);
        if (res.ok) {
          const data = await res.json();
          setDbFlows(data.flows || []);
        }
      } catch {}
    };
    fetchFlows();
  }, [installationId]);

  const completeFlow = useCallback(async (outcome: 'resolved' | 'escalated') => {
    if (activeFlow) {
      try {
        await fetch('/api/care/diagnostic/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            installation_id: installationId,
            diagnostic_flow_id: activeFlow.id,
            steps_completed: stepsCompleted,
            outcome,
          }),
        });
      } catch {}
    }
  }, [activeFlow, installationId, stepsCompleted]);

  const handleBack = useCallback(() => {
    if (view === 'generic-flow') {
      if (stepsCompleted.length > 1) {
        const prev = stepsCompleted[stepsCompleted.length - 2];
        setCurrentStepId(prev);
        setStepsCompleted((s) => s.slice(0, -1));
      } else {
        setView('issues');
        setActiveFlow(null);
        setCurrentStepId(null);
        setStepsCompleted([]);
      }
    } else if (view === 'step-1') {
      setView('issues');
      setIsolatorOn(false);
    } else if (view === 'step-2') {
      setView('step-1');
    } else if (view === 'resolved' || view === 'escalated') {
      setView('issues');
      setIsolatorOn(false);
      setActiveFlow(null);
      setCurrentStepId(null);
      setStepsCompleted([]);
    }
  }, [view, stepsCompleted]);

  const handleSelectIssue = useCallback((issueId: string, flowId?: string) => {
    if (issueId === 'error-light') {
      setView('step-1');
      return;
    }
    // For DB-driven flows
    if (flowId) {
      const flow = dbFlows.find((f) => f.id === flowId);
      if (flow && flow.steps && flow.steps.length > 0) {
        setActiveFlow(flow);
        const firstStep = flow.steps[0];
        setCurrentStepId(firstStep.id);
        setStepsCompleted([firstStep.id]);
        setView('generic-flow');
        return;
      }
    }
  }, [dbFlows]);

  const handleGoHome = useCallback(() => {
    setActiveTab('home');
    setView('issues');
    setIsolatorOn(false);
  }, [setActiveTab]);

  return (
    <div
      className="care-screen-scroll"
      style={{
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        paddingBottom: 100,
        WebkitOverflowScrolling: 'touch',
        background: '#FFFFFF',
      }}
    >
      {/* Keyframes */}
      <style>{`
        @keyframes careDiagFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes careDiagCheckPop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes careDiagPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes careDiagInverterGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.3); }
          50% { box-shadow: 0 0 16px 4px rgba(239, 68, 68, 0.15); }
        }
        @keyframes careDiagInverterGlowGreen {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.3); }
          50% { box-shadow: 0 0 16px 4px rgba(34, 197, 94, 0.15); }
        }
        @keyframes careLedBlink {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px rgba(239, 68, 68, 0.6); }
          50% { opacity: 0.3; box-shadow: 0 0 2px rgba(239, 68, 68, 0.1); }
        }
      `}</style>

      <div style={{ padding: '0 20px' }}>
        {/* ── Back Button (shown when not on issues list) ── */}
        {view !== 'issues' && (
          <div
            style={{
              paddingTop: 52,
              marginBottom: 8,
              animation: 'careDiagFadeIn 350ms cubic-bezier(.16, 1, .3, 1)',
            }}
          >
            <button
              onClick={handleBack}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px 0',
                color: '#B8934C',
                fontSize: 14,
                fontWeight: 600,
                fontFamily: 'inherit',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#B8934C"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>
          </div>
        )}

        {/* ═══ ISSUES LIST VIEW ═══ */}
        {view === 'issues' && (
          <div
            style={{
              animation: mounted
                ? 'careDiagFadeIn 550ms cubic-bezier(.16, 1, .3, 1)'
                : 'none',
            }}
          >
            {/* Header with wrench icon */}
            <div style={{ paddingTop: view === 'issues' ? 56 : 0, marginBottom: 20 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, #D4AF37, #B8934C)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width={22}
                    height={22}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                </div>
                <h1
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: '#1a1a1a',
                    letterSpacing: '-0.03em',
                    margin: 0,
                  }}
                >
                  What&apos;s the issue?
                </h1>
              </div>
              <p
                style={{
                  fontSize: 14,
                  color: '#888',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                Select the issue you&apos;re experiencing and we&apos;ll guide you
                through fixing it.
              </p>
            </div>

            {/* Issue Cards */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {ISSUES.map((issue, i) => (
                <IssueCardButton
                  key={issue.id}
                  issue={issue}
                  index={i}
                  onClick={() => handleSelectIssue(issue.id, issue.flowId)}
                />
              ))}
              {/* DB-driven flows not in hardcoded list */}
              {dbFlows
                .filter((f) => !ISSUES.some((i) => i.title.toLowerCase().includes(f.name.toLowerCase().split(' ')[0])))
                .map((flow, i) => (
                  <IssueCardButton
                    key={flow.id}
                    issue={{
                      id: flow.id,
                      title: flow.name,
                      icon: <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={flow.colour || '#D4AF37'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
                      iconBg: '#F5F3FF',
                      description: flow.description || 'Troubleshoot this issue step by step',
                    }}
                    index={ISSUES.length + i}
                    onClick={() => handleSelectIssue(flow.id, flow.id)}
                  />
                ))}
            </div>
          </div>
        )}

        {/* ═══ STEP 1: AC Isolator Check ═══ */}
        {view === 'step-1' && (
          <div
            style={{
              animation:
                'careDiagFadeIn 550ms cubic-bezier(.16, 1, .3, 1)',
            }}
          >
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#FEF2F2',
                  borderRadius: 100,
                  padding: '4px 12px',
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#EF4444',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Step 1 of 2
                </span>
              </div>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#1a1a1a',
                  letterSpacing: '-0.03em',
                  margin: '0 0 8px',
                }}
              >
                Check AC Isolator
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: '#888',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                Locate the AC isolator switch near your inverter. It&apos;s
                usually a red rotary switch on the wall.
              </p>
            </div>

            {/* Interactive Inverter Diagram (CSS-built) */}
            <div
              style={{
                position: 'relative',
                background: '#F8F8F8',
                borderRadius: 24,
                padding: '32px 24px',
                marginBottom: 20,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              {/* Inverter box */}
              <div
                style={{
                  width: 160,
                  height: 200,
                  borderRadius: 16,
                  background: 'linear-gradient(180deg, #E8E8E8, #D4D4D4)',
                  border: '2px solid #C0C0C0',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: isolatorOn
                    ? 'careDiagInverterGlowGreen 2s ease-in-out infinite'
                    : 'careDiagInverterGlow 2s ease-in-out infinite',
                  transition: 'all 500ms cubic-bezier(.16, 1, .3, 1)',
                }}
              >
                {/* SolarEdge label */}
                <div
                  style={{
                    position: 'absolute',
                    top: 12,
                    left: 0,
                    right: 0,
                    textAlign: 'center',
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#888',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  SolarEdge
                </div>

                {/* LED indicator */}
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: isolatorOn ? '#22C55E' : '#EF4444',
                    boxShadow: isolatorOn
                      ? '0 0 8px rgba(34, 197, 94, 0.6)'
                      : '0 0 8px rgba(239, 68, 68, 0.6)',
                    marginBottom: 16,
                    transition: 'all 500ms cubic-bezier(.16, 1, .3, 1)',
                    animation: isolatorOn ? 'none' : 'careLedBlink 1s ease-in-out infinite',
                  }}
                />

                {/* Display */}
                <div
                  style={{
                    width: 100,
                    height: 40,
                    borderRadius: 6,
                    background: isolatorOn ? '#1a2b1a' : '#2a1a1a',
                    border: '1px solid #999',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 500ms cubic-bezier(.16, 1, .3, 1)',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: 'monospace',
                      color: isolatorOn ? '#22C55E' : '#EF4444',
                      fontWeight: 700,
                      transition: 'color 500ms ease',
                    }}
                  >
                    {isolatorOn ? '3.69 kW' : 'ERR: GFI'}
                  </span>
                </div>

                {/* Bottom vents */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 12,
                    display: 'flex',
                    gap: 4,
                  }}
                >
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: 16,
                        height: 3,
                        borderRadius: 2,
                        background: '#AAA',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* AC Isolator label */}
              <div
                style={{
                  marginTop: 20,
                  textAlign: 'center',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#666',
                  marginBottom: 12,
                }}
              >
                AC Isolator Switch
              </div>

              {/* Toggle Switch */}
              <button
                onClick={() => setIsolatorOn(!isolatorOn)}
                style={{
                  width: 72,
                  height: 40,
                  borderRadius: 20,
                  border: 'none',
                  background: isolatorOn
                    ? 'linear-gradient(135deg, #22C55E, #16A34A)'
                    : '#ccc',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background 300ms cubic-bezier(.16, 1, .3, 1)',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    position: 'absolute',
                    top: 4,
                    left: isolatorOn ? 36 : 4,
                    transition:
                      'left 300ms cubic-bezier(.34, 1.56, .64, 1)',
                  }}
                />
              </button>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  color: isolatorOn ? '#22C55E' : '#EF4444',
                  transition: 'color 300ms ease',
                }}
              >
                {isolatorOn ? 'ON' : 'OFF'}
              </div>
            </div>

            {/* Instruction text */}
            <div
              style={{
                background: isolatorOn ? '#F0FDF4' : '#FEF2F2',
                borderRadius: 16,
                padding: 16,
                marginBottom: 20,
                transition: 'background 300ms ease',
              }}
            >
              <p
                style={{
                  fontSize: 14,
                  color: isolatorOn ? '#166534' : '#991B1B',
                  margin: 0,
                  lineHeight: 1.5,
                  fontWeight: 500,
                }}
              >
                {isolatorOn
                  ? 'The isolator is now ON. If the error light has cleared, your issue may be resolved. If not, proceed to Step 2.'
                  : 'Toggle the switch above to simulate turning the AC isolator ON. Check if the error light clears.'}
              </p>
            </div>

            {/* Action buttons */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {isolatorOn && (
                <>
                  <button
                    onClick={() => setView('resolved')}
                    style={{
                      width: '100%',
                      padding: '16px 24px',
                      borderRadius: 16,
                      border: 'none',
                      background:
                        'linear-gradient(135deg, #22C55E, #16A34A)',
                      color: 'white',
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      WebkitTapHighlightColor: 'transparent',
                      animation:
                        'careDiagFadeIn 400ms cubic-bezier(.16, 1, .3, 1)',
                    }}
                  >
                    Error Light Cleared
                  </button>
                  <button
                    onClick={() => setView('step-2')}
                    style={{
                      width: '100%',
                      padding: '16px 24px',
                      borderRadius: 16,
                      border: '1px solid rgba(0,0,0,0.08)',
                      background: '#FAFAFA',
                      color: '#1a1a1a',
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      WebkitTapHighlightColor: 'transparent',
                      animation:
                        'careDiagFadeIn 400ms cubic-bezier(.16, 1, .3, 1) 60ms both',
                    }}
                  >
                    Still Showing Error
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ═══ STEP 2: Restart Instructions ═══ */}
        {view === 'step-2' && (
          <div
            style={{
              animation:
                'careDiagFadeIn 550ms cubic-bezier(.16, 1, .3, 1)',
            }}
          >
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#FEF2F2',
                  borderRadius: 100,
                  padding: '4px 12px',
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#EF4444',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Step 2 of 2
                </span>
              </div>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#1a1a1a',
                  letterSpacing: '-0.03em',
                  margin: '0 0 8px',
                }}
              >
                Restart Your Inverter
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: '#888',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                Follow these steps carefully to perform a safe restart of your
                SolarEdge inverter.
              </p>
            </div>

            {/* Numbered steps */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                marginBottom: 24,
              }}
            >
              {[
                {
                  step: 1,
                  text: 'Turn OFF the AC isolator switch (red rotary switch near inverter)',
                },
                {
                  step: 2,
                  text: 'Turn OFF the DC isolator switch (located on the bottom of the inverter)',
                },
                {
                  step: 3,
                  text: 'Wait 60 seconds for all capacitors to discharge',
                },
                {
                  step: 4,
                  text: 'Turn the DC isolator back ON first',
                },
                {
                  step: 5,
                  text: 'Then turn the AC isolator back ON',
                },
                {
                  step: 6,
                  text: 'Wait 2-3 minutes for the inverter to initialise and reconnect to the grid',
                },
              ].map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 14,
                    alignItems: 'flex-start',
                    animation: `careDiagFadeIn 450ms cubic-bezier(.16, 1, .3, 1) ${i * 60}ms both`,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background:
                        'linear-gradient(135deg, #D4AF37, #B8934C)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: 'white',
                      }}
                    >
                      {item.step}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: '#1a1a1a',
                      lineHeight: 1.5,
                      fontWeight: 500,
                      paddingTop: 5,
                    }}
                  >
                    {item.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Warning box */}
            <div
              style={{
                background: '#FFFBEB',
                borderRadius: 16,
                padding: 16,
                marginBottom: 24,
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#F59E0B"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0, marginTop: 2 }}
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p
                style={{
                  fontSize: 13,
                  color: '#92400E',
                  margin: 0,
                  lineHeight: 1.5,
                  fontWeight: 500,
                }}
              >
                Always turn off DC before AC when shutting down. When starting
                up, turn on DC first then AC. Never open the inverter cover.
              </p>
            </div>

            {/* Result buttons */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <button
                onClick={() => setView('resolved')}
                style={{
                  width: '100%',
                  padding: '16px 24px',
                  borderRadius: 16,
                  border: 'none',
                  background:
                    'linear-gradient(135deg, #22C55E, #16A34A)',
                  color: 'white',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                Problem Resolved
              </button>
              <button
                onClick={() => setView('escalated')}
                style={{
                  width: '100%',
                  padding: '16px 24px',
                  borderRadius: 16,
                  border: '1px solid rgba(0,0,0,0.08)',
                  background: '#FAFAFA',
                  color: '#1a1a1a',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                Still Not Working
              </button>
            </div>
          </div>
        )}

        {/* ═══ GENERIC FLOW ENGINE ═══ */}
        {view === 'generic-flow' && activeFlow && currentStepId && (() => {
          const step = activeFlow.steps.find((s) => s.id === currentStepId);
          if (!step) return null;
          const stepIndex = activeFlow.steps.findIndex((s) => s.id === currentStepId);
          const totalSteps = activeFlow.steps.filter((s) => s.type !== 'escalate').length;

          const handleStepAction = (action?: string, nextId?: string) => {
            if (action === 'resolved') {
              completeFlow('resolved');
              setView('resolved');
            } else if (action === 'escalate' || action === 'escalated') {
              completeFlow('escalated');
              setView('escalated');
            } else if (nextId) {
              setCurrentStepId(nextId);
              setStepsCompleted((s) => [...s, nextId]);
            }
          };

          return (
            <div style={{ animation: 'careDiagFadeIn 550ms cubic-bezier(.16, 1, .3, 1)' }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F5F3FF', borderRadius: 100, padding: '4px 12px', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Step {stepIndex + 1} of {totalSteps}
                  </span>
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a1a', letterSpacing: '-0.03em', margin: '0 0 8px' }}>
                  {step.title}
                </h2>
                {step.body && (
                  <p style={{ fontSize: 14, color: '#888', margin: 0, lineHeight: 1.5 }}>{step.body}</p>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {step.type === 'yes_no' && (
                  <>
                    <button
                      onClick={() => handleStepAction(step.yes_action, step.yes_next)}
                      style={{ width: '100%', padding: '16px 24px', borderRadius: 16, border: 'none', background: 'linear-gradient(135deg, #22C55E, #16A34A)', color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent' }}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => handleStepAction(step.no_action, step.no_next)}
                      style={{ width: '100%', padding: '16px 24px', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', background: '#FAFAFA', color: '#1a1a1a', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent' }}
                    >
                      No
                    </button>
                  </>
                )}
                {step.type === 'multiple_choice' && step.options?.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleStepAction(opt.action, opt.next)}
                    style={{ width: '100%', padding: '16px 24px', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', background: i === 0 ? 'linear-gradient(135deg, #D4AF37, #B8934C)' : '#FAFAFA', color: i === 0 ? 'white' : '#1a1a1a', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent', animation: `careDiagFadeIn 400ms cubic-bezier(.16, 1, .3, 1) ${i * 60}ms both` }}
                  >
                    {opt.label}
                  </button>
                ))}
                {step.type === 'info' && (
                  <button
                    onClick={() => handleStepAction(undefined, step.next)}
                    style={{ width: '100%', padding: '16px 24px', borderRadius: 16, border: 'none', background: 'linear-gradient(135deg, #D4AF37, #B8934C)', color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent' }}
                  >
                    Continue
                  </button>
                )}
                {step.type === 'escalate' && (
                  <button
                    onClick={() => { completeFlow('escalated'); setView('escalated'); }}
                    style={{ width: '100%', padding: '16px 24px', borderRadius: 16, border: 'none', background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent' }}
                  >
                    Contact Installer
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* ═══ RESOLVED SCREEN ═══ */}
        {view === 'resolved' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              paddingTop: 40,
              animation:
                'careDiagFadeIn 550ms cubic-bezier(.16, 1, .3, 1)',
            }}
          >
            {/* Green checkmark */}
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
                animation:
                  'careDiagCheckPop 600ms cubic-bezier(.34, 1.56, .64, 1)',
              }}
            >
              <svg
                width={40}
                height={40}
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h2
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: '#1a1a1a',
                letterSpacing: '-0.03em',
                margin: '0 0 8px',
              }}
            >
              Problem Resolved!
            </h2>

            <p
              style={{
                fontSize: 15,
                color: '#888',
                margin: '0 0 8px',
                lineHeight: 1.5,
                maxWidth: 280,
              }}
            >
              Great news! Your inverter error has been cleared successfully.
            </p>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#F0FDF4',
                borderRadius: 100,
                padding: '8px 16px',
                marginBottom: 32,
              }}
            >
              <svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#22C55E"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#22C55E',
                }}
              >
                No technician visit needed
              </span>
            </div>

            <button
              onClick={handleGoHome}
              style={{
                width: '100%',
                padding: '16px 24px',
                borderRadius: 16,
                border: 'none',
                background:
                  'linear-gradient(135deg, #D4AF37, #B8934C)',
                color: 'white',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              Back to Home
            </button>
          </div>
        )}

        {/* ═══ ESCALATED SCREEN ═══ */}
        {view === 'escalated' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              paddingTop: 40,
              animation:
                'careDiagFadeIn 550ms cubic-bezier(.16, 1, .3, 1)',
            }}
          >
            {/* Amber phone icon */}
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
                animation:
                  'careDiagCheckPop 600ms cubic-bezier(.34, 1.56, .64, 1)',
              }}
            >
              <svg
                width={36}
                height={36}
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>

            <h2
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: '#1a1a1a',
                letterSpacing: '-0.03em',
                margin: '0 0 8px',
              }}
            >
              We&apos;ll Get This Sorted
            </h2>

            <p
              style={{
                fontSize: 15,
                color: '#888',
                margin: '0 0 8px',
                lineHeight: 1.5,
                maxWidth: 280,
              }}
            >
              Don&apos;t worry - we&apos;ve notified your installer about this
              issue.
            </p>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#FFFBEB',
                borderRadius: 100,
                padding: '8px 16px',
                marginBottom: 24,
              }}
            >
              <svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#F59E0B"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#D97706',
                }}
              >
                {installation.installer_name} has been notified
              </span>
            </div>

            {/* Installer card */}
            <div
              style={{
                width: '100%',
                background: '#FAFAFA',
                borderRadius: 20,
                padding: 20,
                marginBottom: 24,
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background:
                      'linear-gradient(135deg, #D4AF37, #B8934C)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: 'white',
                    }}
                  >
                    SE
                  </span>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: '#1a1a1a',
                    }}
                  >
                    {installation.installer_name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#888',
                      fontWeight: 500,
                    }}
                  >
                    Will contact you within 24 hours
                  </div>
                </div>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: '#666',
                  lineHeight: 1.5,
                }}
              >
                Your issue has been logged with reference{' '}
                <span style={{ fontWeight: 700, color: '#1a1a1a' }}>
                  {installation.job_reference}-D1
                </span>
                . A technician will be in touch to arrange a visit if needed.
              </div>
            </div>

            <button
              onClick={handleGoHome}
              style={{
                width: '100%',
                padding: '16px 24px',
                borderRadius: 16,
                border: 'none',
                background:
                  'linear-gradient(135deg, #D4AF37, #B8934C)',
                color: 'white',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Issue Card Button
   ══════════════════════════════════════════════════════════ */

function IssueCardButton({
  issue,
  index,
  onClick,
}: {
  issue: IssueCard;
  index: number;
  onClick: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100 + index * 60);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        padding: '16px',
        background: '#FAFAFA',
        border: 'none',
        borderRadius: 16,
        cursor: 'pointer',
        textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
        opacity: visible ? 1 : 0,
        transform: pressed
          ? 'scale(0.97)'
          : visible
            ? 'translateY(0) scale(1)'
            : 'translateY(12px) scale(0.98)',
        transition: 'all 450ms cubic-bezier(.16, 1, .3, 1)',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: issue.iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {issue.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: '#1a1a1a',
            marginBottom: 3,
          }}
        >
          {issue.title}
        </div>
        <div style={{ fontSize: 12, color: '#999', fontWeight: 500 }}>
          {issue.description}
        </div>
      </div>
      <svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ccc"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}
