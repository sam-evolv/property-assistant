'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MobileShell from '@/components/dev-app/layout/MobileShell';
import {
  GOLD,
  TEXT_1,
  TEXT_2,
  TEXT_3,
  SURFACE_1,
  BORDER_LIGHT,
  RED,
  AMBER,
  AMBER_BG,
  GREEN,
  GREEN_BG,
} from '@/lib/dev-app/design-system';

// issue_reports status -> chip colour
function statusStyle(status: string): { color: string; bg: string } {
  if (status === 'resolved' || status === 'closed') return { color: GREEN, bg: GREEN_BG };
  return { color: AMBER, bg: AMBER_BG };
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: SURFACE_1,
        border: `1px solid ${BORDER_LIGHT}`,
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}

export default function UnitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const unitId = params.unitId as string;

  const [file, setFile] = useState<any>(null);
  const [snags, setSnags] = useState<any[]>([]);
  const [guide, setGuide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSnags = useCallback(async () => {
    const r = await fetch(`/api/dev-app/units/${unitId}/snags`);
    const d = await r.json();
    setSnags(d.snags ?? []);
  }, [unitId]);

  const loadFile = useCallback(async () => {
    const r = await fetch(`/api/dev-app/units/${unitId}/file`);
    const d = await r.json();
    if (!d.error) setFile(d);
  }, [unitId]);

  const loadGuide = useCallback(async () => {
    const r = await fetch(`/api/dev-app/units/${unitId}/guide`);
    const d = await r.json();
    setGuide(d.guide ?? null);
  }, [unitId]);

  useEffect(() => {
    Promise.all([loadFile(), loadSnags(), loadGuide()])
      .catch(() => setError('Failed to load unit'))
      .finally(() => setLoading(false));
  }, [loadFile, loadSnags, loadGuide]);

  const generateGuide = async () => {
    setGenerating(true);
    setError(null);
    try {
      const r = await fetch(`/api/dev-app/units/${unitId}/guide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue: true }),
      });
      const d = await r.json();
      if (d.guide) {
        setGuide(d.guide);
        await loadFile(); // qa8_ready should flip to ready
      } else {
        setError(d.detail || d.error || 'Generation failed');
      }
    } catch {
      setError('Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const logHandover = async (eventType: string) => {
    await fetch(`/api/dev-app/units/${unitId}/handover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: eventType }),
    });
    await loadFile();
  };

  const hpi = file?.sections?.hpi_qa8_evidence;
  const unit = file?.unit;
  const hpiRows: [string, boolean][] = [
    ['Home User Guide issued', !!hpi?.guide_issued],
    ['Handover demo completed', !!hpi?.demo_completed],
    ['Aftercare activated', !!hpi?.aftercare_activated],
  ];

  return (
    <MobileShell>
      <div style={{ padding: 20 }}>
        <div
          onClick={() => router.back()}
          style={{ color: GOLD, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}
        >
          ← Back
        </div>
        <h1 style={{ color: TEXT_1, fontSize: 22, fontWeight: 700 }}>
          {unit?.unit_number ? `Unit ${unit.unit_number}` : 'Unit'}
        </h1>
        <p style={{ color: TEXT_2, fontSize: 13, marginTop: 2, marginBottom: 18 }}>
          {unit?.address_line_1 ?? ''}
          {unit?.city ? `, ${unit.city}` : ''}
        </p>

        {loading && <p style={{ color: TEXT_3 }}>Loading…</p>}
        {error && <p style={{ color: RED, fontSize: 13, marginBottom: 12 }}>{error}</p>}

        {!loading && (
          <>
            {/* HPI QA 8.0 readiness */}
            <Card>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <span style={{ color: TEXT_1, fontSize: 15, fontWeight: 700 }}>
                  HPI QA 8.0 readiness
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 8,
                    color: hpi?.qa8_ready ? GREEN : AMBER,
                    background: hpi?.qa8_ready ? GREEN_BG : AMBER_BG,
                  }}
                >
                  {hpi?.qa8_ready ? 'READY' : 'INCOMPLETE'}
                </span>
              </div>
              {hpiRows.map(([label, ok]) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '6px 0',
                    borderTop: `1px solid ${BORDER_LIGHT}`,
                  }}
                >
                  <span style={{ color: TEXT_2, fontSize: 13 }}>{label}</span>
                  <span style={{ color: ok ? GREEN : TEXT_3, fontSize: 13, fontWeight: 600 }}>
                    {ok ? 'Yes' : 'No'}
                  </span>
                </div>
              ))}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderTop: `1px solid ${BORDER_LIGHT}`,
                }}
              >
                <span style={{ color: TEXT_2, fontSize: 13 }}>Systems documented</span>
                <span style={{ color: TEXT_1, fontSize: 13, fontWeight: 600 }}>
                  {hpi?.systems_documented ?? 0}
                </span>
              </div>
              {(!hpi?.demo_completed || !hpi?.aftercare_activated) && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {!hpi?.demo_completed && (
                    <button
                      onClick={() => logHandover('demo_completed')}
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: TEXT_1,
                        background: '#fff',
                        border: `1px solid ${BORDER_LIGHT}`,
                        borderRadius: 8,
                        padding: '7px 11px',
                        cursor: 'pointer',
                      }}
                    >
                      Log handover demo
                    </button>
                  )}
                  {!hpi?.aftercare_activated && (
                    <button
                      onClick={() => logHandover('aftercare_activated')}
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: TEXT_1,
                        background: '#fff',
                        border: `1px solid ${BORDER_LIGHT}`,
                        borderRadius: 8,
                        padding: '7px 11px',
                        cursor: 'pointer',
                      }}
                    >
                      Activate aftercare
                    </button>
                  )}
                </div>
              )}
            </Card>

            {/* Home User Guide */}
            <Card>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <span style={{ color: TEXT_1, fontSize: 15, fontWeight: 700 }}>
                  Home User Guide
                </span>
                <button
                  onClick={generateGuide}
                  disabled={generating}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#fff',
                    background: GOLD,
                    border: 'none',
                    borderRadius: 8,
                    padding: '7px 12px',
                    cursor: generating ? 'default' : 'pointer',
                    opacity: generating ? 0.6 : 1,
                  }}
                >
                  {generating ? 'Generating…' : guide ? 'Regenerate & issue' : 'Generate & issue'}
                </button>
              </div>
              {!guide && !generating && (
                <p style={{ color: TEXT_3, fontSize: 13 }}>
                  No guide yet. Generate a system-specific guide from this home&rsquo;s recorded
                  systems.
                </p>
              )}
              {guide?.content && (
                <div>
                  <div style={{ color: TEXT_1, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                    {guide.content.title}
                  </div>
                  <div style={{ color: TEXT_3, fontSize: 11, marginBottom: 8 }}>
                    v{guide.version} · {guide.status}
                    {guide.content.model ? ` · ${guide.content.model}` : ''}
                  </div>
                  <p style={{ color: TEXT_2, fontSize: 13, marginBottom: 10 }}>
                    {guide.content.introduction}
                  </p>
                  {(guide.content.sections ?? []).map((s: any, i: number) => (
                    <div
                      key={i}
                      style={{ borderTop: `1px solid ${BORDER_LIGHT}`, paddingTop: 8, marginTop: 8 }}
                    >
                      <div style={{ color: TEXT_1, fontSize: 13, fontWeight: 700 }}>{s.heading}</div>
                      {s.summary && (
                        <div style={{ color: TEXT_2, fontSize: 12, marginTop: 2 }}>{s.summary}</div>
                      )}
                      {Array.isArray(s.how_to_use) && s.how_to_use.length > 0 && (
                        <ul style={{ margin: '6px 0', paddingLeft: 18 }}>
                          {s.how_to_use.map((t: string, j: number) => (
                            <li key={j} style={{ color: TEXT_2, fontSize: 12, marginBottom: 2 }}>
                              {t}
                            </li>
                          ))}
                        </ul>
                      )}
                      {Array.isArray(s.do_not) && s.do_not.length > 0 && (
                        <div style={{ color: RED, fontSize: 12, marginTop: 4 }}>
                          {s.do_not.map((t: string, j: number) => (
                            <div key={j}>• {t}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Snags — read-only view of the canonical issue_reports for this unit */}
            <Card>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <span style={{ color: TEXT_1, fontSize: 15, fontWeight: 700 }}>
                  Snags
                  {file?.sections?.snags
                    ? ` (${file.sections.snags.open} open / ${file.sections.snags.total})`
                    : ''}
                </span>
                <span
                  onClick={() => router.push('/developer/issues')}
                  style={{ color: GOLD, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  Manage →
                </span>
              </div>

              {snags.length === 0 && (
                <p style={{ color: TEXT_3, fontSize: 13 }}>No snags logged for this unit.</p>
              )}
              {snags.map((s: any) => {
                const st = statusStyle(s.status);
                return (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 0',
                      borderTop: `1px solid ${BORDER_LIGHT}`,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: s.safety_risk ? RED : TEXT_3,
                        marginTop: 6,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: TEXT_1, fontSize: 13 }}>{s.title || s.description}</div>
                      <div
                        style={{
                          display: 'flex',
                          gap: 6,
                          marginTop: 4,
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: st.color,
                            background: st.bg,
                            padding: '2px 7px',
                            borderRadius: 6,
                          }}
                        >
                          {String(s.status).replace(/_/g, ' ')}
                        </span>
                        {s.severity_label && (
                          <span style={{ fontSize: 10, color: TEXT_3 }}>{s.severity_label}</span>
                        )}
                        {s.likely_trade && (
                          <span style={{ fontSize: 10, color: TEXT_3 }}>{s.likely_trade}</span>
                        )}
                        {s.safety_risk && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: RED }}>safety</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </Card>
          </>
        )}
      </div>
    </MobileShell>
  );
}
