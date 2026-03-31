'use client';
import { useState } from 'react';
import { T } from '@/lib/agent/tokens';
import { useAgentData } from '@/hooks/agent/useAgentData';
import { Toggle } from '@/components/agent/ui/Toggle';
import { SectionLabel } from '@/components/agent/ui/SectionLabel';
import { Badge } from '@/components/agent/ui/Badge';
import { Card } from '@/components/agent/ui/Card';
import { FileText, Share2, Download } from 'lucide-react';

type View = 'files' | 'viewings' | 'analytics';

const SCHEME_FILTERS = ['All', 'The Coppice', 'Harbour View', 'Standalone'];

const MONTHLY_DATA = [
  { month: 'Sep', value: 3 }, { month: 'Oct', value: 5 },
  { month: 'Nov', value: 4 }, { month: 'Dec', value: 6 },
  { month: 'Jan', value: 8 }, { month: 'Feb', value: 5 },
];

export default function DocsPage() {
  const { documents, viewings } = useAgentData();
  const [view, setView] = useState<View>('files');
  const [schemeFilter, setSchemeFilter] = useState('All');

  const filteredDocs = schemeFilter === 'All'
    ? documents
    : documents.filter(d => d.scheme_name === schemeFilter);

  const todayViewings = viewings.filter(v => v.viewing_date === 'Today');
  const tomorrowViewings = viewings.filter(v => v.viewing_date === 'Tomorrow');

  return (
    <div style={{ background: T.bg, minHeight: '100%' }}>
      {/* Header */}
      <div style={{ background: T.card, paddingTop: 52, paddingBottom: 14, paddingLeft: 16, paddingRight: 16 }}>
        <SectionLabel>Archive</SectionLabel>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.t1, margin: '0 0 14px', letterSpacing: '-0.02em' }}>
          Documents
        </h1>
        <Toggle
          options={[
            { label: 'Files', value: 'files' as View },
            { label: 'Viewings', value: 'viewings' as View },
            { label: 'Analytics', value: 'analytics' as View },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      <div style={{ padding: 16 }}>
        {/* FILES */}
        {view === 'files' && (
          <>
            {/* Scheme filter */}
            <div style={{
              display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 14,
              msOverflowStyle: 'none', scrollbarWidth: 'none',
            }}>
              {SCHEME_FILTERS.map(f => (
                <button key={f} onClick={() => setSchemeFilter(f)} style={{
                  padding: '7px 14px', borderRadius: 20, border: `1px solid ${T.line}`,
                  background: schemeFilter === f ? T.t1 : T.card,
                  color: schemeFilter === f ? '#FFFFFF' : T.t2,
                  fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', cursor: 'pointer',
                  flexShrink: 0,
                }}>
                  {f}
                </button>
              ))}
            </div>

            <Card style={{ padding: '4px 16px' }}>
              {filteredDocs.map(doc => (
                <div key={doc.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 0', borderBottom: `1px solid ${T.line}`,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, background: T.infoL,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <FileText size={16} color={T.info} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, color: T.t1, whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {doc.name}
                    </div>
                    <div style={{ fontSize: 11, color: T.t3 }}>
                      {doc.scheme_name} · {doc.views} views · {doc.uploaded_at}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={{
                      width: 30, height: 30, borderRadius: 8, background: T.s1,
                      border: 'none', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Share2 size={14} color={T.t3} />
                    </button>
                    <button style={{
                      width: 30, height: 30, borderRadius: 8, background: T.s1,
                      border: 'none', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Download size={14} color={T.t3} />
                    </button>
                  </div>
                </div>
              ))}
            </Card>
          </>
        )}

        {/* VIEWINGS */}
        {view === 'viewings' && (
          <>
            {todayViewings.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <SectionLabel>Today</SectionLabel>
                <Card style={{ padding: '4px 16px' }}>
                  {todayViewings.map(v => (
                    <div key={v.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 0', borderBottom: `1px solid ${T.line}`,
                    }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 10, background: T.s1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, color: T.t2,
                      }}>
                        {v.viewing_time}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.t1 }}>{v.buyer_name}</div>
                        <div style={{ fontSize: 11, color: T.t3 }}>{v.unit_ref}</div>
                      </div>
                      <Badge status={v.status} />
                    </div>
                  ))}
                </Card>
              </div>
            )}
            {tomorrowViewings.length > 0 && (
              <div>
                <SectionLabel>Tomorrow</SectionLabel>
                <Card style={{ padding: '4px 16px' }}>
                  {tomorrowViewings.map(v => (
                    <div key={v.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 0', borderBottom: `1px solid ${T.line}`,
                    }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 10, background: T.s1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, color: T.t2,
                      }}>
                        {v.viewing_time}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.t1 }}>{v.buyer_name}</div>
                        <div style={{ fontSize: 11, color: T.t3 }}>{v.unit_ref}</div>
                      </div>
                      <Badge status={v.status} />
                    </div>
                  ))}
                </Card>
              </div>
            )}
          </>
        )}

        {/* ANALYTICS */}
        {view === 'analytics' && (
          <>
            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                { n: '31', label: 'Units Sold', bg: T.goldL, color: T.goldD },
                { n: '12', label: 'Active Buyers', bg: T.infoL, color: T.info },
                { n: '€12.4M', label: 'Total Revenue', bg: T.warnL, color: T.warn },
                { n: '94%', label: 'Conversion Rate', bg: T.goL, color: T.go },
              ].map(s => (
                <div key={s.label} style={{
                  background: s.bg, borderRadius: 14, padding: '18px 16px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.n}</div>
                  <div style={{ fontSize: 11, color: s.color, opacity: 0.7 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Bar chart */}
            <Card style={{ padding: '18px 16px' }}>
              <SectionLabel>Monthly Sales</SectionLabel>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, marginTop: 12 }}>
                {MONTHLY_DATA.map((d, i) => {
                  const maxVal = Math.max(...MONTHLY_DATA.map(m => m.value));
                  const h = (d.value / maxVal) * 100;
                  const isHighlight = d.month === 'Jan';
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{
                        width: '100%', maxWidth: 32, height: h, borderRadius: 4,
                        background: isHighlight ? T.gold : T.s2,
                      }} />
                      <span style={{ fontSize: 10, color: T.t4, marginTop: 6 }}>{d.month}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
