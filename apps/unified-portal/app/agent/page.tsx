'use client';

import { useState } from 'react';
import { CARD, LINE, T1, T3, GOLD, SHADOW_CARD } from '@/lib/agent/design-tokens';
import { AGENT_STATS } from '@/lib/agent/demo-data';
import HomeTab from './overview/HomeTab';
import PipelineTab from './pipeline/PipelineTab';
import IntelligenceTab from './intelligence/IntelligenceTab';
import DocsTab from './docs/DocsTab';
import ProfileTab from './profile/ProfileTab';

/* ─── Tab config ─── */
const TABS = [
  { id: 'home', label: 'Home', icon: homeIcon },
  { id: 'pipeline', label: 'Pipeline', icon: pipeIcon },
  { id: 'intel', label: 'Intelligence', icon: zapIcon, special: true },
  { id: 'docs', label: 'Docs', icon: docsIcon },
  { id: 'profile', label: 'Profile', icon: personIcon },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function AgentApp() {
  const [tab, setTab] = useState<TabId>('home');
  const urgentCount = AGENT_STATS.urgent;

  const renderTab = () => {
    switch (tab) {
      case 'home': return <HomeTab onNavigate={setTab} />;
      case 'pipeline': return <PipelineTab />;
      case 'intel': return <IntelligenceTab />;
      case 'docs': return <DocsTab />;
      case 'profile': return <ProfileTab />;
    }
  };

  return (
    <div style={{
      width: '100%', maxWidth: 390, height: '100dvh', margin: '0 auto',
      display: 'flex', flexDirection: 'column', background: '#FFFFFF',
      position: 'relative', overflow: 'hidden', fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* ─── Status bar / Header ─── */}
      <div style={{
        height: 50, background: CARD, flexShrink: 0,
        borderBottom: `1px solid ${LINE}`, display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', zIndex: 80,
      }}>
        <span style={{ color: T1, fontSize: 13, fontWeight: 600 }}>9:41</span>

        {/* Centre wordmark: OPENHOUSE · firstName */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: GOLD, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em' }}>OPENHOUSE</span>
          <span style={{ width: 1, height: 10, background: LINE }} />
          <span style={{ color: T3, fontSize: 11, fontWeight: 400, letterSpacing: '0.03em' }}>Sarah</span>
        </div>

        {/* Bell with live count badge */}
        <div className="interactive" style={{ position: 'relative' }}>
          <BellSvg />
          {urgentCount > 0 && (
            <div style={{
              position: 'absolute', top: -4, right: -4,
              minWidth: 16, height: 16, borderRadius: 8,
              background: '#EF4444', border: '2px solid #FFFFFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 3px',
            }}>
              <span style={{ color: '#fff', fontSize: 9, fontWeight: 700, lineHeight: 1 }}>
                {urgentCount > 9 ? '9+' : urgentCount}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Content area ─── */}
      <div style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
      }}>
        {renderTab()}
      </div>

      {/* ─── Bottom Tab Bar ─── */}
      <nav style={{
        height: 66, paddingTop: 6,
        background: CARD, flexShrink: 0,
        borderTop: `1px solid ${LINE}`,
        display: 'flex', alignItems: 'flex-end',
        boxShadow: `0 -1px 0 ${LINE}, 0 -8px 24px rgba(0,0,0,0.04)`,
        zIndex: 100,
      }}>
        {TABS.map(t => {
          const active = tab === t.id;
          const isIntel = t.special;

          if (isIntel) {
            /* Intelligence — FAB that rises above the nav */
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id as TabId)}
                className="interactive"
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', position: 'relative',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', padding: 0,
                }}
              >
                <div style={{
                  position: 'absolute', bottom: 22,
                  width: 52, height: 52, borderRadius: 26,
                  background: active ? T1 : '#FFFFFF',
                  border: active ? 'none' : '1.5px solid #E5E7EB',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: active
                    ? '0 4px 16px rgba(17,24,39,0.3), 0 1px 4px rgba(17,24,39,0.2)'
                    : SHADOW_CARD,
                  transition: 'all 0.22s cubic-bezier(0.2, 0.8, 0.3, 1)',
                }}>
                  {t.icon(20, active ? GOLD : T3)}
                </div>
                <span style={{
                  fontSize: 9, fontWeight: active ? 700 : 400,
                  color: active ? T1 : T3,
                  paddingBottom: 8, marginTop: 'auto',
                }}>
                  {t.label}
                </span>
              </button>
            );
          }

          /* Standard tab */
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as TabId)}
              className="interactive"
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 3, paddingBottom: 8,
                position: 'relative', background: 'none',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {/* Gold active indicator at top */}
              {active && (
                <div style={{
                  position: 'absolute', top: 0, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 16, height: 2.5, borderRadius: '0 0 3px 3px',
                  background: GOLD,
                }} />
              )}

              {t.icon(20, active ? T1 : T3)}

              <span style={{
                color: active ? T1 : T3,
                fontSize: 9, fontWeight: active ? 700 : 400,
              }}>
                {t.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ─── SVG Icons ─── */

function homeIcon(s: number, c: string) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9,22 9,12 15,12 15,22" />
    </svg>
  );
}

function pipeIcon(s: number, c: string) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function zapIcon(s: number, c: string) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke={c} strokeWidth="1.5">
      <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2" />
    </svg>
  );
}

function docsIcon(s: number, c: string) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}

function personIcon(s: number, c: string) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function BellSvg() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}
