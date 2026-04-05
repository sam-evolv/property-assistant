'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { C, TYPE, RADIUS, EASE, DURATION, KEYFRAMES, TAB_H } from '@/components/select/tokens';
import WelcomeScreen from '@/components/select/WelcomeScreen';
import HomeScreen from '@/components/select/HomeScreen';
import SystemsScreen from '@/components/select/SystemsScreen';
import StoryScreen from '@/components/select/StoryScreen';
import DocsWarrantyScreen from '@/components/select/DocsWarrantyScreen';
import AIScreen from '@/components/select/AIScreen';

// ─── 4 regular tabs + centre intelligence ────────────────────────────────────
const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'systems', label: 'Systems' },
  // Intelligence button sits in the centre (index 2) — rendered specially
  { id: 'story', label: 'Story' },
  { id: 'docs', label: 'Docs' },
] as const;

type TabId = typeof TABS[number]['id'] | 'intel';

// ─── SVG icon paths ──────────────────────────────────────────────────────────
const ICONS: Record<string, (s: number, c: string) => JSX.Element> = {
  home: (s, c) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9,22 9,12 15,12 15,22" />
    </svg>
  ),
  systems: (s, c) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  story: (s, c) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  docs: (s, c) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  ),
};

// ─── Intelligence zap icon ───────────────────────────────────────────────────
function ZapIcon({ size = 18, color = C.bg }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth={1.5}>
      <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2" />
    </svg>
  );
}

interface UnitData {
  purchaser_name: string;
  address: string;
  city?: string;
  builder_name?: string;
  handover_date?: string;
  tier?: string;
  unit_id?: string;
  development_name?: string;
}

export default function SelectPage() {
  const { unitUid } = useParams() as { unitUid: string };

  const [unitData, setUnitData] = useState<UnitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [welcomed, setWelcomed] = useState(false);
  const [tab, setTab] = useState<TabId>('home');

  // Check if already welcomed
  useEffect(() => {
    const key = `oh_select_welcomed_${unitUid}`;
    if (localStorage.getItem(key) === 'true') setWelcomed(true);
  }, [unitUid]);

  // Fetch unit data
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/houses/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: unitUid }),
        });
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        setUnitData({
          purchaser_name: data.purchaser_name || 'Homeowner',
          address: data.address || '',
          city: data.city || data.eircode || '',
          builder_name: data.builder_name || data.development_name || 'Builder',
          handover_date: data.handover_date || data.est_handover_date || undefined,
          tier: data.tier,
          unit_id: data.unit_id || data.unitId,
          development_name: data.development_name,
        });
      } catch {
        setUnitData({
          purchaser_name: 'Sarah Murphy',
          address: '14 Innishmore Rise',
          city: 'Cork',
          builder_name: 'Sigma Homes',
          handover_date: '2024-12-14',
          tier: 'select',
          unit_id: unitUid,
          development_name: 'Rathard Park',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [unitUid]);

  const handleEnter = useCallback(() => {
    localStorage.setItem(`oh_select_welcomed_${unitUid}`, 'true');
    setWelcomed(true);
  }, [unitUid]);

  // Render current tab content
  const renderTab = () => {
    if (!unitData) return null;
    switch (tab) {
      case 'home':
        return (
          <HomeScreen
            purchaserName={unitData.purchaser_name}
            address={unitData.address}
            city={unitData.city || ''}
            builderName={unitData.builder_name || ''}
            handoverDate={unitData.handover_date}
            solarKw={3.1}
            heatPumpActive={true}
            onAI={() => setTab('intel')}
          />
        );
      case 'systems':
        return (
          <SystemsScreen
            solarKwNow={3.1} solarKwhToday={4.2} solarKwhMonth={112}
            solarSelfUse={68} heatPumpFlowTemp={42} heatPumpMode="Heating"
            heatPumpDhwTemp={51} evChargerStatus="Standby"
          />
        );
      case 'intel':
        return (
          <AIScreen
            unitUid={unitUid}
            purchaserName={unitData.purchaser_name}
            address={unitData.address}
            builderName={unitData.builder_name}
            handoverDate={unitData.handover_date}
          />
        );
      case 'story':
        return (
          <StoryScreen
            builderName={unitData.builder_name || 'Sigma Homes'}
            builderPhone="021 436 5866"
            handoverDate={unitData.handover_date}
          />
        );
      case 'docs':
        return <DocsWarrantyScreen />;
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div style={{
        width: '100%', height: '100dvh', background: C.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '"Inter", system-ui, sans-serif',
      }}>
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES + '\n@keyframes spin{to{transform:rotate(360deg)}}' }} />
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: `2px solid ${C.gB}`, borderTopColor: C.g,
          animation: 'spin 1s linear infinite',
        }} />
      </div>
    );
  }

  // ── Error ──
  if (error || !unitData) {
    return (
      <div style={{
        width: '100%', height: '100dvh', background: C.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '"Inter", system-ui, sans-serif',
        color: C.t2, ...TYPE.body,
      }}>
        {error || 'Something went wrong.'}
      </div>
    );
  }

  // ── Welcome ──
  if (!welcomed) {
    return (
      <WelcomeScreen
        purchaserName={unitData.purchaser_name}
        address={unitData.address}
        handoverDate={unitData.handover_date ? new Date(unitData.handover_date) : undefined}
        onEnter={handleEnter}
      />
    );
  }

  const isIntel = tab === 'intel';

  // ── Main app ──
  return (
    <div style={{
      width: '100%', height: '100dvh', background: C.bg,
      overflow: 'hidden', fontFamily: '"Inter", system-ui, sans-serif',
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* ── Top bar ── */}
      <div style={{
        height: 48, flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 20px',
        borderBottom: `1px solid ${C.b1}`, zIndex: 80,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: C.g, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em' }}>
            OPENHOUSE
          </span>
          <span style={{ width: 1, height: 10, background: C.b1 }} />
          <span style={{ color: C.t2, fontSize: 11, fontWeight: 400, letterSpacing: '0.04em' }}>
            Select
          </span>
        </div>
        {/* Notification dot placeholder */}
        <div style={{ position: 'relative' }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={C.t2} strokeWidth={1.75}>
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          <div style={{
            position: 'absolute', top: -1, right: -1,
            width: 7, height: 7, borderRadius: 4,
            background: C.g, border: `2px solid ${C.bg}`,
          }} />
        </div>
      </div>

      {/* ── Content area ── */}
      <div style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch' as any,
      }}>
        {renderTab()}
      </div>

      {/* ── Tab bar — 4 tabs + centre intelligence button ── */}
      <div style={{
        height: TAB_H, flexShrink: 0,
        background: 'rgba(4,4,10,0.94)',
        backdropFilter: 'blur(28px) saturate(1.3)',
        borderTop: `1px solid rgba(255,255,255,0.045)`,
        display: 'flex', alignItems: 'center',
        paddingBottom: 2, zIndex: 100,
      }}>
        {/* Home tab */}
        <TabButton id="home" label="Home" active={tab === 'home'} onClick={() => setTab('home')} />

        {/* Systems tab */}
        <TabButton id="systems" label="Systems" active={tab === 'systems'} onClick={() => setTab('systems')} />

        {/* ── Centre Intelligence FAB — dark circle with OH logo protruding above nav ── */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', position: 'relative',
          alignSelf: 'stretch',
        }}>
          {/* Notch arch — masks the nav border behind the FAB */}
          <div style={{
            position: 'absolute', top: -2,
            width: 100, height: 16,
            background: 'rgba(4,4,10,0.94)',
            borderRadius: '50% 50% 0 0',
          }} />

          {/* The FAB — 80px dark circle with OH logo */}
          <button
            onClick={() => setTab('intel')}
            style={{
              position: 'absolute', bottom: -2,
              width: 80, height: 80, borderRadius: 40,
              background: C.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', border: 'none', cursor: 'pointer', padding: 0,
              boxShadow: isIntel
                ? `0 0 0 1px rgba(255,255,255,0.10) inset,
                   0 0 0 2.5px ${C.g},
                   0 8px 24px rgba(0,0,0,0.35),
                   0 2px 6px rgba(0,0,0,0.20)`
                : `0 0 0 1px rgba(255,255,255,0.10) inset,
                   0 8px 24px rgba(0,0,0,0.35),
                   0 2px 6px rgba(0,0,0,0.20)`,
              transition: `box-shadow 0.22s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.15s ease`,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <Image
              src="/oh-logo-icon.png"
              width={80}
              height={80}
              alt="OpenHouse Intelligence"
              style={{ objectFit: 'contain' }}
              priority
            />
          </button>
        </div>

        {/* Story tab */}
        <TabButton id="story" label="Story" active={tab === 'story'} onClick={() => setTab('story')} />

        {/* Docs tab */}
        <TabButton id="docs" label="Docs" active={tab === 'docs'} onClick={() => setTab('docs')} />
      </div>
    </div>
  );
}

// ─── Tab button helper ────────────────────────────────────────────────────────
function TabButton({ id, label, active, onClick }: {
  id: string; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 3, padding: '8px 2px 0',
        position: 'relative', background: 'none',
        border: 'none', cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {active && (
        <div style={{
          position: 'absolute', top: 0, left: '50%',
          transform: 'translateX(-50%)',
          width: 14, height: 2, borderRadius: '0 0 2px 2px',
          background: C.g,
        }} />
      )}
      {ICONS[id]?.(20, active ? C.g : C.t3)}
      <span style={{
        color: active ? C.g : C.t3,
        fontSize: 9, fontWeight: active ? 700 : 400,
        letterSpacing: '0.01em',
      }}>
        {label}
      </span>
    </button>
  );
}
