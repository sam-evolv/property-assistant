'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { C, TYPE, RADIUS, EASE, DURATION, KEYFRAMES, TAB_H, TABS } from '@/components/select/tokens';
import WelcomeScreen from '@/components/select/WelcomeScreen';
import HomeScreen from '@/components/select/HomeScreen';
import SystemsScreen from '@/components/select/SystemsScreen';
import StoryScreen from '@/components/select/StoryScreen';
import DocsScreen from '@/components/select/DocsScreen';
import WarrantyScreen from '@/components/select/WarrantyScreen';
import AIScreen from '@/components/select/AIScreen';

// ─── Tab icons (inline SVG paths) ────────────────────────────────────────────
const TAB_ICONS: Record<string, string> = {
  home: 'M3 12l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z',
  systems: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 3a1 1 0 110 2 1 1 0 010-2zm-1 4h2v8h-2z',
  story: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  docs: 'M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zm7 0v5h5',
  warranty: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
};

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
  const [page, setPage] = useState(0);
  const [aiOpen, setAiOpen] = useState(false);

  // Swipe refs
  const dragRef = useRef<{ startX: number; startPage: number } | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

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
        });
      } catch {
        setError('Could not load your home. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [unitUid]);

  // Mark welcomed
  const handleEnter = useCallback(() => {
    localStorage.setItem(`oh_select_welcomed_${unitUid}`, 'true');
    setWelcomed(true);
  }, [unitUid]);

  // Swipe handlers
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startPage: page };
  }, [page]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    if (Math.abs(dx) > 52) {
      const dir = dx < 0 ? 1 : -1;
      const next = Math.max(0, Math.min(4, dragRef.current.startPage + dir));
      setPage(next);
    }
    dragRef.current = null;
  }, []);

  // ── Loading state ──
  if (loading) {
    return (
      <div style={{
        width: '100%', height: '100dvh', background: C.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '"Inter", system-ui, sans-serif',
      }}>
        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: `2px solid ${C.gB}`, borderTopColor: C.g,
          animation: 'spin 1s linear infinite',
        }} />
        <style dangerouslySetInnerHTML={{ __html: '@keyframes spin{to{transform:rotate(360deg)}}' }} />
      </div>
    );
  }

  // ── Error state ──
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

  // ── Welcome screen ──
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

  // ── Main app ──
  return (
    <div style={{
      width: '100%', height: '100dvh', background: C.bg,
      overflow: 'hidden', fontFamily: '"Inter", system-ui, sans-serif',
      position: 'relative',
    }}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* ── Top bar ── */}
      <div style={{
        position: 'relative', zIndex: 10,
        height: 48, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 20px',
        borderBottom: `1px solid ${C.b1}`,
      }}>
        {/* Wordmark */}
        <div style={{
          ...TYPE.title, color: C.g, letterSpacing: '0.04em',
          fontSize: 13,
        }}>
          OpenHouse <span style={{ fontWeight: 400, color: C.t2 }}>Select</span>
        </div>
        {/* Page dots */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {TABS.map((_, i) => (
            <div key={i} style={{
              width: i === page ? 16 : 5, height: 5,
              borderRadius: 3,
              background: i === page ? C.g : C.b2,
              transition: `all ${DURATION.base}ms ${EASE}`,
            }} />
          ))}
        </div>
      </div>

      {/* ── Slide rail ── */}
      <div
        ref={railRef}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        style={{
          display: 'flex',
          width: '500%',
          height: `calc(100dvh - 48px - ${TAB_H}px)`,
          transform: `translateX(-${page * 20}%)`,
          transition: `transform ${DURATION.slide}ms ${EASE}`,
          touchAction: 'pan-y',
        }}
      >
        <div style={{ width: '20%', height: '100%', overflow: 'hidden' }}>
          <HomeScreen
            purchaserName={unitData.purchaser_name}
            address={unitData.address}
            city={unitData.city || ''}
            builderName={unitData.builder_name || ''}
            handoverDate={unitData.handover_date}
            solarKw={3.1}
            heatPumpActive={true}
            onAI={() => setAiOpen(true)}
          />
        </div>
        <div style={{ width: '20%', height: '100%', overflow: 'hidden' }}>
          <SystemsScreen
            solarKwNow={3.1}
            solarKwhToday={4.2}
            solarKwhMonth={112}
            solarSelfUse={68}
            heatPumpFlowTemp={42}
            heatPumpMode="Heating"
            heatPumpDhwTemp={51}
            evChargerStatus="Standby"
          />
        </div>
        <div style={{ width: '20%', height: '100%', overflow: 'hidden' }}>
          <StoryScreen
            builderName={unitData.builder_name || 'Sigma Homes'}
            builderPhone="021 436 5866"
            handoverDate={unitData.handover_date}
          />
        </div>
        <div style={{ width: '20%', height: '100%', overflow: 'hidden' }}>
          <DocsScreen />
        </div>
        <div style={{ width: '20%', height: '100%', overflow: 'hidden' }}>
          <WarrantyScreen />
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: TAB_H, zIndex: 20,
        background: 'rgba(4,4,10,0.94)',
        backdropFilter: 'blur(28px) saturate(1.3)',
        borderTop: `1px solid rgba(255,255,255,0.045)`,
        display: 'flex', alignItems: 'center',
      }}>
        {/* Sliding gold bar */}
        <div style={{
          position: 'absolute', top: -1, height: 2,
          width: '20%', left: `${page * 20}%`,
          background: `linear-gradient(90deg, transparent, ${C.g}, transparent)`,
          transition: `left ${DURATION.slide}ms ${EASE}`,
        }} />

        {TABS.map((tab, i) => (
          <button
            key={tab.id}
            onClick={() => setPage(i)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 3,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 0',
              opacity: i === page ? 1 : 0.4,
              transition: `opacity ${DURATION.fast}ms ${EASE}`,
            }}
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none"
              stroke={i === page ? C.g : C.t2} strokeWidth={1.8}
              strokeLinecap="round" strokeLinejoin="round"
            >
              <path d={TAB_ICONS[tab.id]} />
            </svg>
            <span style={{
              ...TYPE.micro,
              color: i === page ? C.g : C.t3,
            }}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* ── AI Overlay ── */}
      {aiOpen && (
        <AIScreen
          unitUid={unitUid}
          purchaserName={unitData.purchaser_name}
          address={unitData.address}
          onClose={() => setAiOpen(false)}
        />
      )}
    </div>
  );
}
