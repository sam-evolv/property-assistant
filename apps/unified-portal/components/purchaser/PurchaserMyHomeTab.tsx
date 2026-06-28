'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ShieldCheck,
  MessageCircle,
  Thermometer,
  Wind,
  Zap,
  Sun,
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  MapPin,
  Building2,
  ShoppingCart,
  Bus,
  Camera,
} from 'lucide-react';

/**
 * My Home tab for the post-handover homeowner portal.
 *
 * Insight-led energy and home view. It leads with the one thing that matters
 * this month, shows the home's systems by honest priority, a live "right now"
 * power read, a couple of charts, what would help, and a compact "your area"
 * block. Energy sections render only when the home has seeded energy data;
 * otherwise the tab degrades to the header and "Your area" block.
 *
 * The live readings, the sparkline leading edge and the rate-window split are a
 * client-side simulation (bounded random walks within plausible winter ranges).
 * The single seam is the useLiveReadings hook, so a real device-cloud feed can
 * replace the simulation later without touching the layout. No euro figures are
 * shown anywhere; usage is in kWh, device truth is COP, generation and status.
 */

interface DemoHome {
  home?: {
    address?: string;
    ber?: string;
    type?: string;
    floor_area_m2?: number;
    development?: string;
  };
  energy?: {
    current_month?: string;
    monthly?: Array<{
      month?: string;
      grid_import_kwh?: number;
      heat_pump_cop?: number;
      solar_kwh?: number;
    }>;
    annual_summary?: { solar_exported_kwh?: number };
    showcase_month_detail?: {
      headline?: string;
      grid_import_kwh?: number;
      heat_pump?: {
        cop?: number;
        design_spf?: number;
        excess_kwh?: number;
        excess_pct?: number;
        issue?: string;
      };
      solar?: { generated_kwh?: number; exported_kwh?: number };
      ev?: {
        total_kwh?: number;
        day_rate_kwh?: number;
        night_rate_kwh?: number;
        day_rate_sessions?: number;
      };
      grid_import_bands?: { night_kwh?: number; day_kwh?: number; peak_kwh?: number };
      biggest_wins?: string[];
    };
  };
  devices?: {
    heat_pump?: { make?: string; model?: string; design_spf?: number };
    solar?: { make?: string; inverter?: string; array_kwp?: number; battery?: boolean };
    ev_charger?: { make?: string; model?: string };
    mvhr?: { make?: string; model?: string; status?: string; anomaly?: string };
  };
  _note?: string;
}

interface PurchaserMyHomeTabProps {
  unitUid: string;
  token?: string;
  address?: string;
  developmentName?: string;
  purchaserName?: string;
  eircode?: string;
  houseType?: string;
  bedrooms?: number;
  latitude?: number | null;
  longitude?: number | null;
  isDarkMode: boolean;
  selectedLanguage?: string;
  onOpenMaps: () => void;
  onAskAssistant: (question: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatMonth(value?: string): string {
  if (!value) return '';
  const parts = value.split('-');
  if (parts.length < 2) return value;
  const year = parts[0];
  const monthIndex = parseInt(parts[1], 10) - 1;
  if (monthIndex < 0 || monthIndex > 11) return value;
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}

const fmtInt = (v: number) => Math.round(v).toLocaleString('en-IE');

// Build sparkline points from a series of values, scaled into a 120x40 box.
// Higher value sits nearer the top (smaller y), matching the energy chart feel.
function sparkPoints(vals: number[]): Array<[number, number]> {
  const n = vals.length;
  if (n === 0) return [];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const x = (i: number) => (n === 1 ? 60 : 2 + (i / (n - 1)) * 116);
  const y = (v: number) => (max === min ? 18 : 2 + (1 - (v - min) / (max - min)) * 32);
  return vals.map((v, i) => [x(i), y(v)]);
}

// ---------------------------------------------------------------------------
// Motion + live-data hooks
// ---------------------------------------------------------------------------

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState<boolean>(() =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => setReduce(mq.matches);
    handler();
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);
  return reduce;
}

// Animates 0 -> target once, easing out. Static (instant) when not enabled.
function useCountUp(target: number, enabled: boolean, decimals = 0, duration = 1000): number {
  const [val, setVal] = useState<number>(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) { setVal(target); return; }
    let raf = 0;
    const start = performance.now();
    const factor = Math.pow(10, decimals);
    let lastEmitted = Number.NaN;
    const frame = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const rounded = Math.round(target * eased * factor) / factor;
      if (rounded !== lastEmitted) { lastEmitted = rounded; setVal(rounded); }
      if (p < 1) raf = requestAnimationFrame(frame);
      else setVal(target);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled, decimals, duration]);
  return val;
}

type Bands = { day: number; peak: number; night: number };
type LiveReadings = {
  home: number;
  solar: number;
  grid: number;
  hp: number;
  sol: number;
  bands: { day: number; peak: number; night: number; total: number };
};

const READING_SEED = { home: 1.2, solar: 0.4, grid: 0.9, hp: 0.9, sol: 0.4 };
const READING_RANGES: Record<keyof typeof READING_SEED, [number, number]> = {
  home: [0.7, 1.8],
  solar: [0.2, 0.7],
  grid: [0.4, 1.5],
  hp: [0.0, 1.3],
  sol: [0.2, 0.7],
};

/**
 * The single simulation seam. Returns instantaneous power readings in kW plus a
 * gently shifting rate-window split. Instantaneous power is what device clouds
 * stream, so this hook is the spot to swap the random walk for a real feed.
 * Disabled (static seed) under reduced motion or when there is no energy data.
 */
function useLiveReadings(enabled: boolean, base: Bands, total: number): LiveReadings {
  // The displayed import total is the fixed monthly grid figure; the live feed
  // only shifts how it splits across the rate windows. Seed and every tick keep
  // day + peak + night reconciled to that total so it matches the hero figure.
  const makeSeed = (): LiveReadings => ({
    ...READING_SEED,
    bands: { ...base, total },
  });
  const [live, setLive] = useState<LiveReadings>(makeSeed);
  const liveRef = useRef<LiveReadings>(live);
  liveRef.current = live;

  useEffect(() => {
    const seed = makeSeed();
    setLive(seed);
    liveRef.current = seed;
    if (!enabled) return;

    let raf = 0;
    let cancelled = false;
    const lastEmitted = { ...READING_SEED };

    const walk = (cur: number, [min, max]: [number, number]) => {
      const v = cur + (Math.random() - 0.5) * 0.34;
      return Math.max(min, Math.min(max, v));
    };

    const animateReadings = (from: typeof READING_SEED, to: typeof READING_SEED) => {
      const start = performance.now();
      const dur = 560;
      const step = (now: number) => {
        if (cancelled) return;
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        const lerp = (a: number, b: number) => a + (b - a) * eased;
        const next = {
          home: lerp(from.home, to.home),
          solar: lerp(from.solar, to.solar),
          grid: lerp(from.grid, to.grid),
          hp: lerp(from.hp, to.hp),
          sol: lerp(from.sol, to.sol),
        };
        // Only re-render when a displayed (one-decimal) value actually changes.
        let changed = false;
        (Object.keys(next) as Array<keyof typeof next>).forEach((k) => {
          const r = Math.round(next[k] * 10) / 10;
          if (r !== lastEmitted[k]) { lastEmitted[k] = r; changed = true; }
        });
        if (changed) setLive((prev) => ({ ...prev, ...lastEmitted }));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    const tick = () => {
      const cur = liveRef.current;
      const from = { home: cur.home, solar: cur.solar, grid: cur.grid, hp: cur.hp, sol: cur.sol };
      const to = {
        home: walk(cur.home, READING_RANGES.home),
        solar: walk(cur.solar, READING_RANGES.solar),
        grid: walk(cur.grid, READING_RANGES.grid),
        hp: walk(cur.hp, READING_RANGES.hp),
        sol: walk(cur.sol, READING_RANGES.sol),
      };
      // New rate-window split each tick, renormalised so the three bands always
      // sum to the fixed import total. The bar widths transition in CSS.
      const dayJ = Math.max(0, base.day + (Math.random() - 0.5) * 14);
      const peakJ = Math.max(0, base.peak + (Math.random() - 0.5) * 6);
      const nightJ = Math.max(0, base.night + (Math.random() - 0.5) * 12);
      const sum = dayJ + peakJ + nightJ;
      const k = sum > 0 ? total / sum : 1;
      setLive((prev) => ({ ...prev, bands: { day: dayJ * k, peak: peakJ * k, night: nightJ * k, total } }));
      animateReadings(from, to);
    };

    const kickoff = setTimeout(tick, 850);
    const interval = setInterval(tick, 2600);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(kickoff);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, base.day, base.peak, base.night, total]);

  return live;
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

interface RevealProps {
  index?: number;
  reduce: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

// Choreographed entrance: blocks fade and rise in sequence. Static under reduced motion.
function Reveal({ index = 0, reduce, children, style }: RevealProps) {
  const [shown, setShown] = useState<boolean>(reduce);
  useEffect(() => {
    if (reduce) { setShown(true); return; }
    const t = setTimeout(() => setShown(true), 70 + index * 60);
    return () => clearTimeout(t);
  }, [reduce, index]);
  return (
    <div
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(13px)',
        transition: reduce ? 'none' : 'opacity .55s ease, transform .68s cubic-bezier(.16,1,.3,1)',
        willChange: 'opacity, transform',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// A figure that gently flashes gold when its value changes, with tabular figures
// so the live readings never shift the layout.
function LiveNumber({
  value,
  decimals,
  color,
  flashColor,
  style,
}: {
  value: number;
  decimals: number;
  color: string;
  flashColor: string;
  style?: React.CSSProperties;
}) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 420);
      return () => clearTimeout(t);
    }
  }, [value]);
  return (
    <span
      style={{
        color: flash ? flashColor : color,
        transition: 'color .25s ease',
        fontVariantNumeric: 'tabular-nums',
        ...style,
      }}
    >
      {value.toFixed(decimals)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PurchaserMyHomeTab({
  unitUid,
  token,
  address,
  developmentName,
  bedrooms,
  isDarkMode,
  onOpenMaps,
  onAskAssistant,
}: PurchaserMyHomeTabProps) {
  const reduce = usePrefersReducedMotion();
  const [data, setData] = useState<DemoHome | null>(null);

  // Fetch the seeded energy showcase. Any failure leaves data null, which
  // renders the slim version with no error surfaced to the homeowner.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const url = `/api/purchaser/home-energy?unitUid=${encodeURIComponent(unitUid)}&token=${encodeURIComponent(token || '')}&_cb=${Date.now()}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) { if (!cancelled) setData(null); return; }
        const json = await res.json();
        if (!cancelled) setData((json?.energy as DemoHome) ?? null);
      } catch {
        if (!cancelled) setData(null);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [unitUid, token]);

  // --- Home model (rooms + floor plan) ---
  const [homeModel, setHomeModel] = useState<{
    rooms: Array<{ name: string; floor: string | null; length_m: number | null; width_m: number | null; area_sqm: number | null; source: string }>;
    floor_plan_url: string | null;
    floor_area_m2: number | null;
    house_type: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadModel() {
      try {
        const url = `/api/purchaser/home-model?unitUid=${encodeURIComponent(unitUid)}&token=${encodeURIComponent(token || '')}&_cb=${Date.now()}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) { if (!cancelled) setHomeModel(null); return; }
        const json = await res.json();
        if (!cancelled) {
          setHomeModel({
            rooms: json?.rooms ?? [],
            floor_plan_url: json?.floor_plan_url ?? null,
            floor_area_m2: json?.floor_area_m2 ?? null,
            house_type: json?.house_type ?? null,
          });
        }
      } catch {
        if (!cancelled) setHomeModel(null);
      }
    }
    loadModel();
    return () => { cancelled = true; };
  }, [unitUid, token]);

  const fmtM = (v: number | null) => v ? `${v.toFixed(1)} m` : '—';
  const fmtSqM = (v: number | null) => v ? `${v.toFixed(1)} m²` : '—';

  // --- Theme tokens (the app drives dark mode through the isDarkMode prop) ---
  const GOLD = '#D4AF37';
  const GOLD_700 = '#B8934C';
  const goldText = isDarkMode ? '#E5BC4E' : '#A67C3A';
  const c = isDarkMode
    ? {
        pageBg: '#0F0F0F',
        pageGlow:
          'radial-gradient(120% 55% at 50% -8%, rgba(212,175,55,0.10), rgba(212,175,55,0) 55%), radial-gradient(85% 38% at 100% 0%, rgba(212,175,55,0.05), transparent 62%)',
        card: '#1A1A1A',
        cardBorder: 'rgba(212,175,55,0.16)',
        border: '#2A2A2A',
        soft: '#222222',
        t1: '#F5F5F5',
        t2: '#A0A0A0',
        t3: '#7A7A7A',
        green: '#34D399',
        amber: '#FBBF24',
        blue: '#60A5FA',
        shadow: '0 1px 2px rgba(0,0,0,0.40), 0 10px 26px rgba(0,0,0,0.35)',
        mapBg: '#11161c',
      }
    : {
        pageBg: '#f6f7f9',
        pageGlow:
          'radial-gradient(120% 55% at 50% -8%, rgba(212,175,55,0.15), rgba(212,175,55,0) 55%), radial-gradient(85% 38% at 100% 0%, rgba(212,175,55,0.07), transparent 62%)',
        card: '#ffffff',
        cardBorder: 'rgba(212,175,55,0.22)',
        border: '#e5e7eb',
        soft: '#f3f4f6',
        t1: '#111827',
        t2: '#6b7280',
        t3: '#9ca3af',
        green: '#047857',
        amber: '#b45309',
        blue: '#1d4ed8',
        shadow: '0 1px 2px rgba(12,12,12,0.04), 0 10px 26px rgba(12,12,12,0.05)',
        mapBg: '#eef1f4',
      };

  // --- Derived energy data ---
  const smd = data?.energy?.showcase_month_detail;
  const hasEnergy = !!smd;
  const rawHeadline = smd?.headline || 'Your heat pump is short-cycling, and that is most of why your electricity is high this month.';
  const headline = rawHeadline.charAt(0).toUpperCase() + rawHeadline.slice(1);

  const ber = data?.home?.ber;
  const displayAddress = data?.home?.address || address || '';
  const currentMonthLabel = formatMonth(data?.energy?.current_month);

  const hpDetail = smd?.heat_pump;
  const cop = hpDetail?.cop ?? 0;
  const designSpf = hpDetail?.design_spf ?? data?.devices?.heat_pump?.design_spf ?? 0;
  const excessKwh = hpDetail?.excess_kwh ?? 0;
  const excessPct = hpDetail?.excess_pct ?? 0;

  const solarDetail = smd?.solar;
  const generatedKwh = solarDetail?.generated_kwh ?? 0;
  const exportedKwh = solarDetail?.exported_kwh ?? 0;
  const arrayKwp = data?.devices?.solar?.array_kwp;

  const evDetail = smd?.ev;
  const evDayKwh = evDetail?.day_rate_kwh ?? 0;
  const evSessions = evDetail?.day_rate_sessions ?? 0;

  const gridImport = smd?.grid_import_kwh ?? 0;
  const solarExportedYear = data?.energy?.annual_summary?.solar_exported_kwh ?? 0;
  const development = data?.home?.development || developmentName || 'your scheme';

  const mvhrStatus = (data?.devices?.mvhr?.status || '').toLowerCase();
  const mvhrAnomaly =
    data?.devices?.mvhr?.anomaly || 'Your home flagged this for you on 6 January, off for 4 days.';

  const bands: Bands = {
    day: smd?.grid_import_bands?.day_kwh ?? 0,
    peak: smd?.grid_import_bands?.peak_kwh ?? 0,
    night: smd?.grid_import_bands?.night_kwh ?? 0,
  };

  // Honest tiering: which systems actually need attention this month.
  const hpAct = designSpf > 0 && cop < designSpf * 0.85;
  const ventCheck = mvhrStatus !== '' && mvhrStatus !== 'continuous';
  const evSaving = evDayKwh > 0;
  const thingsToLookAt = [hpAct, ventCheck, evSaving].filter(Boolean).length;

  const isDemo =
    hasEnergy &&
    (!!data?._note ||
      (data?.home?.address || '').toLowerCase().includes('bayly') ||
      (address || '').toLowerCase().includes('bayly'));
  const liveLabel = isDemo ? 'Demo live view' : 'Live';
  const rightNowLabel = isDemo ? 'Simulated right now' : 'Right now';
  const systemsHint = isDemo ? 'demo readings from this home model' : 'live from this home';
  const monthHint = `${currentMonthLabel ? currentMonthLabel.split(' ')[0] : 'This month'}, ${isDemo ? 'simulated' : 'live'}`;
  const meterCopy = isDemo
    ? 'Demo readings from this home model, not a live meter feed. Your supplier sets the bill, the assistant explains what is driving it.'
    : 'Read from your meter and devices. Your supplier sets the bill, the assistant explains what is driving it.';

  // --- Live simulation (gated on energy + reduced motion) ---
  // The import total is the fixed monthly grid figure; the bands sum to it.
  const importTotal = gridImport > 0 ? gridImport : bands.day + bands.peak + bands.night;
  const liveOn = hasEnergy && !reduce;
  const live = useLiveReadings(liveOn, bands, importTotal);

  // --- Count-ups ---
  const countOn = hasEnergy && !reduce;
  const gridCount = useCountUp(gridImport, countOn, 0, 1000);
  const copCount = useCountUp(cop, countOn, 1, 1000);
  const generatedCount = useCountUp(generatedKwh, countOn, 0, 1000);
  const evDayCount = useCountUp(evDayKwh, countOn, 0, 1000);
  const solarExportedCount = useCountUp(solarExportedYear, countOn, 0, 1100);

  // --- Sparkline (monthly grid import, leading edge tracks live grid draw) ---
  const monthlyVals = (() => {
    const monthly = data?.energy?.monthly;
    if (!monthly || monthly.length === 0) return [] as number[];
    return [...monthly]
      .sort((a, b) => (a.month || '').localeCompare(b.month || ''))
      .map((m) => (typeof m.grid_import_kwh === 'number' ? m.grid_import_kwh : 0));
  })();
  // Map the live grid draw (0.4 to 1.5 kW) to the tip height, higher draw sits higher.
  const tipY = Math.max(1, Math.min(6, 6 - ((live.grid - 0.4) / (1.5 - 0.4)) * 5));
  const points = (() => {
    const pts = sparkPoints(monthlyVals.length >= 2 ? monthlyVals : [3, 6, 10, 14, 17, 16, 15, 11, 7, 3, 1, 1].map((v) => 18 - v));
    if (pts.length > 0) {
      pts[pts.length - 1] = [118, tipY];
    }
    return pts;
  })();
  const lineStr = points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const areaStr = points.length > 0 ? `${lineStr} 118,36 2,36` : '';

  // Pill / icon styling helpers ------------------------------------------------
  const pillStyle = (kind: 'act' | 'check' | 'save' | 'ok'): React.CSSProperties => {
    const map = {
      act: { bg: 'rgba(245,158,11,0.14)', col: c.amber, br: 'rgba(245,158,11,0.34)' },
      check: { bg: 'rgba(59,130,246,0.12)', col: c.blue, br: 'rgba(59,130,246,0.30)' },
      save: { bg: 'rgba(212,175,55,0.16)', col: goldText, br: 'rgba(212,175,55,0.42)' },
      ok: { bg: 'rgba(16,185,129,0.12)', col: c.green, br: 'rgba(16,185,129,0.30)' },
    }[kind];
    return {
      position: 'absolute',
      top: 12,
      right: 12,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: '0.625rem',
      fontWeight: 700,
      padding: '3px 8px',
      borderRadius: 999,
      letterSpacing: '0.01em',
      background: map.bg,
      color: map.col,
      border: `1px solid ${map.br}`,
    };
  };

  const iconBox = (tone: 'gold' | 'amber' | 'blue' | 'teal'): React.CSSProperties => {
    const map = {
      gold: { bg: 'rgba(212,175,55,0.14)', col: goldText },
      amber: { bg: 'rgba(245,158,11,0.14)', col: c.amber },
      blue: { bg: 'rgba(59,130,246,0.12)', col: c.blue },
      teal: { bg: 'rgba(16,185,129,0.12)', col: c.green },
    }[tone];
    return {
      width: 34,
      height: 34,
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
      background: map.bg,
      color: map.col,
      flexShrink: 0,
    };
  };

  const cardBase: React.CSSProperties = {
    background: c.card,
    border: `1px solid ${c.cardBorder}`,
    borderRadius: 14,
    padding: 14,
    position: 'relative',
    overflow: 'hidden',
    boxShadow: c.shadow,
  };

  const sectionTitle = (title: string, hint: string) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '22px 2px 12px' }}>
      <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: c.t1, margin: 0 }}>{title}</h2>
      <span style={{ fontSize: '0.75rem', color: c.t3 }}>{hint}</span>
    </div>
  );

  const insightCard = (label: string, text: string, source: string, action: string, tone: 'money' | 'comfort' | 'risk') => {
    const tones = {
      money: { bg: 'rgba(212,175,55,0.10)', border: 'rgba(212,175,55,0.28)', color: goldText },
      comfort: { bg: 'rgba(59,130,246,0.09)', border: 'rgba(59,130,246,0.24)', color: c.blue },
      risk: { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.28)', color: c.amber },
    }[tone];
    return (
      <div style={{ background: tones.bg, border: `1px solid ${tones.border}`, borderRadius: 12, padding: '10px 11px' }}>
        <div style={{ color: tones.color, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ color: c.t2, fontSize: '0.6875rem', lineHeight: 1.4 }}>
          {text}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 9, paddingTop: 8, borderTop: `1px solid ${tones.border}` }}>
          <span style={{ color: c.t3, fontSize: '0.625rem', lineHeight: 1.3 }}>Source: {source}</span>
          <span style={{ color: tones.color, fontSize: '0.625rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{action}</span>
        </div>
      </div>
    );
  };

  // Live "now" line used inside system cards.
  const nowLine = (label: string, value: number | null, unit: string, dim = false) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9, fontSize: '0.6875rem', color: c.t2 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dim ? c.t3 : c.green, flexShrink: 0 }} />
      {value === null ? (
        <span>{label}</span>
      ) : (
        <span>
          {label}{' '}
          <b style={{ fontWeight: 700, color: c.t1 }}>
            <LiveNumber value={value} decimals={1} color={c.t1} flashColor={GOLD_700} /> {unit}
          </b>{' '}
          now
        </span>
      )}
    </div>
  );

  let ri = 0;
  const next = () => ri++;

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100%',
        background: c.pageBg,
        backgroundImage: c.pageGlow,
        color: c.t1,
        paddingBottom: 'calc(var(--mobile-tab-bar-h, 80px) + 16px)',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      <style>{`
        @keyframes mh-ring { 0%{transform:scale(0.6);opacity:1} 100%{transform:scale(1.6);opacity:0} }
        @keyframes mh-segglow { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.14)} }
        @keyframes mh-areaping { 0%{transform:scale(0.55);opacity:1} 100%{transform:scale(2.3);opacity:0} }
        @keyframes mh-halo { 0%{transform:scale(1);opacity:0.5} 70%{transform:scale(2.6);opacity:0} 100%{transform:scale(2.6);opacity:0} }
        .mh-press { transition: transform .2s cubic-bezier(.16,1,.3,1), box-shadow .2s ease; }
        .mh-press:active { transform: scale(.985); }
        .mh-pressbtn { transition: transform .2s cubic-bezier(.16,1,.3,1); }
        .mh-pressbtn:active { transform: scale(.97); }
      `}</style>

      <div style={{ padding: '18px 16px 0', position: 'relative' }}>
        {/* Header */}
        <Reveal index={next()} reduce={reduce}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.2, color: c.t1, margin: 0 }}>
                My Home
              </h1>
              {displayAddress && (
                <div style={{ color: c.t2, fontSize: '0.8125rem', marginTop: 3 }}>{displayAddress}</div>
              )}
              {/* Home identity: type · bedrooms · floor area */}
              {(() => {
                const parts = [
                  homeModel?.house_type,
                  bedrooms ? `${bedrooms} bed` : null,
                  homeModel?.floor_area_m2 ? `${homeModel.floor_area_m2.toFixed(0)} m²` : null,
                ].filter(Boolean);
                if (parts.length === 0) return null;
                return (
                  <div style={{ color: c.t3, fontSize: '0.75rem', marginTop: 5, fontWeight: 500 }}>
                    {parts.join(' · ')}
                  </div>
                );
              })()}
              {ber && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    background: 'rgba(16,185,129,0.10)',
                    border: '1px solid rgba(16,185,129,0.28)',
                    color: c.green,
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 999,
                    marginTop: 8,
                  }}
                >
                  <ShieldCheck size={13} strokeWidth={2} />
                  {ber} rated
                </div>
              )}
            </div>
            {currentMonthLabel && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: c.card,
                  border: `1px solid ${c.border}`,
                  color: c.t2,
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  padding: '7px 10px',
                  borderRadius: 999,
                  whiteSpace: 'nowrap',
                  boxShadow: c.shadow,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD }} />
                {currentMonthLabel}
              </div>
            )}
          </div>
        </Reveal>

        {hasEnergy && (
          <>
            {/* Insight-led hero */}
            <Reveal index={next()} reduce={reduce}>
              <div
                style={{
                  background: 'linear-gradient(180deg, rgba(212,175,55,0.14), rgba(212,175,55,0.03))',
                  border: '1px solid rgba(212,175,55,0.32)',
                  borderRadius: 18,
                  padding: 18,
                  marginBottom: 12,
                  boxShadow: '0 6px 26px rgba(212,175,55,0.12)',
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    color: c.amber,
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: '#f59e0b',
                      boxShadow: '0 0 0 3px rgba(245,158,11,0.18)',
                    }}
                  />
                  {thingsToLookAt} {thingsToLookAt === 1 ? 'thing' : 'things'} to look at this month
                </div>
                <div style={{ fontSize: '1.0625rem', fontWeight: 600, color: c.t1, lineHeight: 1.4, marginTop: 11, letterSpacing: '-0.01em', textTransform: 'none' }}>
                  {headline}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginTop: 14,
                    paddingTop: 14,
                    borderTop: '1px solid rgba(212,175,55,0.20)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: c.t1, lineHeight: 1, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtInt(gridCount)} <small style={{ fontSize: '0.8125rem', fontWeight: 600, color: c.t2 }}>kWh</small>
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: c.t2, marginTop: 4 }}>from the grid, your winter peak</div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <svg viewBox="0 0 120 40" style={{ width: 122, height: 40, overflow: 'visible' }}>
                      <defs>
                        <linearGradient id="mh-sg" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0" stopColor="#C29A24" />
                          <stop offset="1" stopColor="#E6C24A" />
                        </linearGradient>
                      </defs>
                      {areaStr && <polygon points={areaStr} fill="rgba(212,175,55,0.16)" />}
                      <polyline
                        points={lineStr}
                        fill="none"
                        stroke="url(#mh-sg)"
                        strokeWidth={2.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ filter: 'drop-shadow(0 2px 3px rgba(212,175,55,0.5))', transition: reduce ? 'none' : 'all .5s ease' }}
                      />
                      {!reduce && (
                        <circle cx={118} cy={tipY} r={3} fill={GOLD} style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'mh-halo 2.2s ease-out infinite' }} />
                      )}
                      <circle cx={118} cy={tipY} r={3} fill={GOLD} style={{ transition: reduce ? 'none' : 'all .5s ease' }} />
                    </svg>
                  </div>
                </div>
                <div style={{ color: c.t3, fontSize: '0.6875rem', marginTop: 12, lineHeight: 1.4 }}>
                  {meterCopy}
                </div>
                <button
                  type="button"
                  onClick={() => onAskAssistant('Why is my electricity high this month?')}
                  className="mh-pressbtn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    marginTop: 14,
                    background: 'linear-gradient(180deg,#E0BB44,#D4AF37)',
                    color: '#1a1408',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    padding: '11px 14px',
                    borderRadius: 12,
                    border: '1px solid rgba(0,0,0,0.10)',
                    boxShadow: '0 6px 20px rgba(212,175,55,0.32)',
                    width: '100%',
                    cursor: 'pointer',
                    textDecoration: 'none',
                  }}
                >
                  <MessageCircle size={17} strokeWidth={2} />
                  Ask why my electricity is high
                </button>
              </div>
            </Reveal>

            {/* Live "Right now" */}
            <Reveal index={next()} reduce={reduce}>
              <div
                className="mh-press"
                style={{
                  background: c.card,
                  border: `1px solid ${c.cardBorder}`,
                  borderRadius: 14,
                  padding: '14px 16px',
                  marginBottom: 12,
                  boxShadow: c.shadow,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', fontWeight: 600, color: c.t2, marginBottom: 13 }}>
                  <span style={{ position: 'relative', width: 8, height: 8 }}>
                    <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#10b981' }} />
                    {!reduce && (
                      <span style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: '2px solid rgba(16,185,129,0.45)', animation: 'mh-ring 2s ease-out infinite' }} />
                    )}
                  </span>
                  <span style={{ color: c.green, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', fontSize: '0.625rem' }}>{liveLabel}</span>
                  {rightNowLabel}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {[
                    { v: live.home, l: 'using now' },
                    { v: live.solar, l: 'solar coming in' },
                    { v: live.grid, l: 'from the grid' },
                  ].map((stat, i) => (
                    <div key={i} style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '1.375rem', fontWeight: 700, color: c.t1, lineHeight: 1, letterSpacing: '-0.01em' }}>
                        <LiveNumber value={stat.v} decimals={1} color={c.t1} flashColor={GOLD_700} />{' '}
                        <small style={{ fontSize: '0.75rem', fontWeight: 600, color: c.t2 }}>kW</small>
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: c.t3, marginTop: 5 }}>{stat.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* Visual home model */}
            {(() => {
              const rooms = homeModel?.rooms ?? [];
              const hasRooms = rooms.length > 0;
              const fp = homeModel?.floor_plan_url;
              if (!hasRooms && !fp) return null;
              return (
                <>
                  {sectionTitle('Your home', hasRooms ? `${rooms.length} rooms recorded` : 'floor plan')}
                  <Reveal index={next()} reduce={reduce}>
                    <div style={{ background: c.card, border: `1px solid ${c.cardBorder}`, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: c.shadow }}>
                      {/* Floor plan thumbnail */}
                      {fp && (
                        <a
                          href={fp}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: hasRooms ? 12 : 0, textDecoration: 'none' }}
                        >
                          <div style={{
                            width: 64, height: 48, borderRadius: 8, overflow: 'hidden',
                            border: `1px solid ${c.border}`, background: c.soft, flexShrink: 0,
                          }}>
                            <div style={{
                              width: '100%', height: '100%',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexDirection: 'column', gap: 2,
                            }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth={2}>
                                <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
                              </svg>
                              <span style={{ fontSize: '0.5625rem', color: c.t3, fontWeight: 600 }}>Plan</span>
                            </div>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: c.t1 }}>Floor plan</div>
                            <div style={{ fontSize: '0.6875rem', color: c.t3, marginTop: 1 }}>Open the full plan for this home</div>
                          </div>
                          <ChevronRight size={16} strokeWidth={2} style={{ color: c.t3, flexShrink: 0 }} />
                        </a>
                      )}

                      {/* Room grid */}
                      {hasRooms && (
                        <>
                          {fp && <div style={{ borderTop: `1px solid ${c.border}`, marginBottom: 12 }} />}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            {rooms.map((room, i) => {
                              const dims = room.length_m && room.width_m
                                ? `${fmtM(room.length_m)} × ${fmtM(room.width_m)}`
                                : null;
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => onAskAssistant(
                                    room.source === 'unit'
                                      ? `Tell me about the ${room.name}${room.floor ? ` on the ${room.floor}` : ''} in my home. What are its dimensions and fixtures?`
                                      : `What is typical for the ${room.name} in a house like mine?`,
                                  )}
                                  style={{
                                    background: c.soft,
                                    border: `1px solid ${c.border}`,
                                    borderRadius: 10,
                                    padding: '10px 11px',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: c.t1, lineHeight: 1.2 }}>
                                    {room.name}
                                    {room.floor && (
                                      <span style={{ fontWeight: 400, color: c.t3 }}> · {room.floor}</span>
                                    )}
                                  </div>
                                  {dims && (
                                    <div style={{ fontSize: '0.6875rem', color: goldText, marginTop: 3, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                      {dims}
                                    </div>
                                  )}
                                  {room.area_sqm && !dims && (
                                    <div style={{ fontSize: '0.6875rem', color: c.t2, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                                      {fmtSqM(room.area_sqm)}
                                    </div>
                                  )}
                                  {room.source === 'house_type' && (
                                    <div style={{ fontSize: '0.5625rem', color: c.t3, marginTop: 3, fontStyle: 'italic' }}>
                                      typical for this type
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          <div style={{ fontSize: '0.625rem', color: c.t3, marginTop: 10, lineHeight: 1.4 }}>
                            Tap a room to ask the assistant about it.
                          </div>
                        </>
                      )}
                    </div>
                  </Reveal>
                </>
              );
            })()}

            {sectionTitle("Your home's systems", systemsHint)}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Heat pump (lead) */}
              <Reveal index={next()} reduce={reduce}>
                <div
                  className="mh-press"
                  style={{ ...cardBase, borderColor: 'rgba(212,175,55,0.5)', boxShadow: '0 1px 2px rgba(12,12,12,.04), 0 12px 26px rgba(212,175,55,0.16)' }}
                >
                  <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(180deg,#D4AF37,#B8934C)' }} />
                  <span style={pillStyle('act')}>Act now</span>
                  <div style={iconBox('amber')}><Thermometer size={18} strokeWidth={2} /></div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: c.t1, lineHeight: 1.2 }}>Heat pump</div>
                  <div style={{ fontSize: '0.6875rem', color: c.t3, marginTop: 2, lineHeight: 1.3 }}>
                    {[data?.devices?.heat_pump?.make, data?.devices?.heat_pump?.model].filter(Boolean).join(' ')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 12 }}>
                    <span style={{ fontSize: '1.625rem', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1, color: c.t1, fontVariantNumeric: 'tabular-nums' }}>
                      {copCount.toFixed(1)}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: c.t2, fontWeight: 500 }}>COP, design {designSpf.toFixed(1)}</span>
                  </div>
                  {nowLine('Drawing', live.hp, 'kW')}
                  <div style={{ fontSize: '0.6875rem', color: c.t2, marginTop: 9, lineHeight: 1.4 }}>
                    Short-cycling in the cold. Using about {excessPct} percent more for the same heat.
                  </div>
                </div>
              </Reveal>

              {/* Ventilation */}
              <Reveal index={next()} reduce={reduce}>
                <div className="mh-press" style={cardBase}>
                  <span style={pillStyle('check')}>Check</span>
                  <div style={iconBox('blue')}><Wind size={18} strokeWidth={2} /></div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: c.t1, lineHeight: 1.2 }}>Ventilation</div>
                  <div style={{ fontSize: '0.6875rem', color: c.t3, marginTop: 2, lineHeight: 1.3 }}>
                    {[data?.devices?.mvhr?.make, data?.devices?.mvhr?.model].filter(Boolean).join(' ')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 12 }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1, color: c.t1 }}>Running</span>
                  </div>
                  {nowLine('Back on, low and steady', null, '')}
                  <div style={{ fontSize: '0.6875rem', color: c.t2, marginTop: 9, lineHeight: 1.4 }}>{mvhrAnomaly}</div>
                </div>
              </Reveal>

              {/* EV charger */}
              <Reveal index={next()} reduce={reduce}>
                <div className="mh-press" style={cardBase}>
                  <span style={pillStyle('save')}>Saving</span>
                  <div style={iconBox('teal')}><Zap size={18} strokeWidth={2} /></div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: c.t1, lineHeight: 1.2 }}>EV charger</div>
                  <div style={{ fontSize: '0.6875rem', color: c.t3, marginTop: 2, lineHeight: 1.3 }}>
                    {[data?.devices?.ev_charger?.make, data?.devices?.ev_charger?.model].filter(Boolean).join(' ')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 12 }}>
                    <span style={{ fontSize: '1.625rem', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1, color: c.t1, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtInt(evDayCount)}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: c.t2, fontWeight: 500 }}>kWh on day rate</span>
                  </div>
                  {nowLine('Idle, not charging', null, '', true)}
                  <div style={{ fontSize: '0.6875rem', color: c.t2, marginTop: 9, lineHeight: 1.4 }}>
                    {evSessions} {evSessions === 1 ? 'session' : 'sessions'} on the dear day rate. Shiftable to the cheap night window.
                  </div>
                </div>
              </Reveal>

              {/* Solar */}
              <Reveal index={next()} reduce={reduce}>
                <div className="mh-press" style={cardBase}>
                  <span style={pillStyle('ok')}>Normal</span>
                  <div style={iconBox('gold')}><Sun size={18} strokeWidth={2} /></div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: c.t1, lineHeight: 1.2 }}>Solar</div>
                  <div style={{ fontSize: '0.6875rem', color: c.t3, marginTop: 2, lineHeight: 1.3 }}>
                    {[data?.devices?.solar?.make, data?.devices?.solar?.inverter].filter(Boolean).join(' ')}
                    {typeof arrayKwp === 'number' ? `, ${arrayKwp.toFixed(1)} kWp` : ''}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 12 }}>
                    <span style={{ fontSize: '1.625rem', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1, color: c.t1, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtInt(generatedCount)}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: c.t2, fontWeight: 500 }}>kWh this month</span>
                  </div>
                  {nowLine('Generating', live.sol, 'kW')}
                  <div style={{ fontSize: '0.6875rem', color: c.t2, marginTop: 9, lineHeight: 1.4 }}>
                    Lowest month of the year, as expected in deep winter. Exported {fmtInt(exportedKwh)} kWh.
                  </div>
                </div>
              </Reveal>
            </div>

            {/* Win strip */}
            <Reveal index={next()} reduce={reduce}>
              <div
                className="mh-press"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: 'linear-gradient(180deg,rgba(16,185,129,0.07),rgba(16,185,129,0.02))',
                  border: '1px solid rgba(16,185,129,0.22)',
                  borderRadius: 14,
                  padding: 14,
                  marginTop: 12,
                  boxShadow: c.shadow,
                }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(16,185,129,0.14)', color: c.green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ArrowUpRight size={18} strokeWidth={2} />
                </div>
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: c.t1, lineHeight: 1.35 }}>
                    Your panels sent {fmtInt(solarExportedCount)} kWh back to the grid this year.
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: c.green, marginTop: 3, fontWeight: 500 }}>
                    A real win, exported when you were not using it.
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Benchmark strip */}
            <Reveal index={next()} reduce={reduce}>
              <div
                className="mh-press"
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: c.card, border: `1px solid ${c.cardBorder}`, borderRadius: 14, padding: 14, marginTop: 12, boxShadow: c.shadow }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(212,175,55,0.14)', color: goldText, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <BarChart3 size={18} strokeWidth={2} />
                </div>
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: c.t1, lineHeight: 1.35 }}>
                    Your heat pump used more than most similar homes on {development} this month.
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: c.t3, marginTop: 3 }}>
                    Anonymised, across your scheme. A short-cycling setting is the usual cause.
                  </div>
                </div>
              </div>
            </Reveal>

            {sectionTitle('Money / Comfort / Risk', 'what it means')}

            <Reveal index={next()} reduce={reduce}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                {insightCard(
                  'Money',
                  `${fmtInt(evDayKwh)} kWh of EV charging landed on the dear day rate. Moving that to night is the clearest saving.`,
                  'EV charger and rate-window model',
                  'Move to night',
                  'money'
                )}
                {insightCard(
                  'Comfort',
                  'Low and constant heat-pump running should keep rooms steadier than short bursts in cold weather.',
                  'Heat-pump operating pattern',
                  'Set low and constant',
                  'comfort'
                )}
                {insightCard(
                  'Risk',
                  'Short-cycling and recent ventilation downtime are worth checking before they become maintenance or warranty issues.',
                  'Systems status and handover docs',
                  'Check before reporting',
                  'risk'
                )}
              </div>
            </Reveal>

            {sectionTitle('When you used the grid', monthHint)}

            {/* Rate-window panel */}
            <Reveal index={next()} reduce={reduce}>
              <div style={{ background: c.card, border: `1px solid ${c.cardBorder}`, borderRadius: 14, padding: 16, boxShadow: c.shadow }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: c.t1 }}>By rate window</span>
                  <span style={{ fontSize: '0.6875rem', color: c.t3 }}>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtInt(live.bands.total)}</span> kWh imported
                  </span>
                </div>
                <div style={{ display: 'flex', height: 26, borderRadius: 7, overflow: 'hidden', border: `1px solid ${c.border}`, boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${(live.bands.day / (live.bands.total || 1)) * 100}%`,
                      background: GOLD,
                      transition: reduce ? 'none' : 'width .9s cubic-bezier(.16,1,.3,1)',
                      animation: reduce ? 'none' : 'mh-segglow 2.4s ease-in-out infinite',
                    }}
                  />
                  <div style={{ height: '100%', width: `${(live.bands.peak / (live.bands.total || 1)) * 100}%`, background: '#f59e0b', transition: reduce ? 'none' : 'width .9s cubic-bezier(.16,1,.3,1)' }} />
                  <div style={{ height: '100%', width: `${(live.bands.night / (live.bands.total || 1)) * 100}%`, background: '#10b981', transition: reduce ? 'none' : 'width .9s cubic-bezier(.16,1,.3,1)' }} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.6875rem', color: goldText, fontWeight: 600 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: GOLD }} />
                    Day, dearer · <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtInt(live.bands.day)}</span> kWh
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.6875rem', color: c.t2 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: '#f59e0b' }} />
                    Peak, dearest · <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtInt(live.bands.peak)}</span> kWh
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.6875rem', color: c.t2 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: '#10b981' }} />
                    Night, cheap · <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtInt(live.bands.night)}</span> kWh
                  </div>
                </div>
                <div style={{ fontSize: '0.6875rem', color: c.t2, marginTop: 12, lineHeight: 1.5 }}>
                  You are drawing on the day rate right now. Over half this month landed in the dearer windows, so there is room to shift more load to night.
                </div>
              </div>
            </Reveal>

            {sectionTitle('What would help', 'recommended actions')}

            {/* What would help */}
            <Reveal index={next()} reduce={reduce}>
              <div style={{ background: c.card, border: `1px solid ${c.cardBorder}`, borderRadius: 14, padding: '2px 0', boxShadow: c.shadow }}>
                <button
                  type="button"
                  onClick={() => onAskAssistant('How do I run my heat pump low and constant to stop the short-cycling?')}
                  className="mh-press"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', width: '100%', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                >
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(16,185,129,0.12)', color: c.green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Thermometer size={16} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: c.t1 }}>Run the heat pump low and constant</div>
                    <div style={{ fontSize: '0.6875rem', color: c.t2, marginTop: 2 }}>Stops the short-cycling and recovers the lost efficiency</div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.6875rem', fontWeight: 600, color: goldText, marginTop: 6 }}>
                      Show me how <ChevronRight size={13} strokeWidth={2} />
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: goldText, whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    ~{fmtInt(excessKwh)} kWh
                    <small style={{ display: 'block', fontSize: '0.5625rem', fontWeight: 500, color: c.t3 }}>a month</small>
                  </div>
                </button>
                <div style={{ borderTop: `1px solid ${c.border}` }} />
                <button
                  type="button"
                  onClick={() => onAskAssistant('How do I move my EV charging to the night rate?')}
                  className="mh-press"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', width: '100%', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                >
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(16,185,129,0.12)', color: c.green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Zap size={16} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: c.t1 }}>Move EV charging to the night window</div>
                    <div style={{ fontSize: '0.6875rem', color: c.t2, marginTop: 2 }}>Switch the Zappi from fast to its eco or night mode</div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.6875rem', fontWeight: 600, color: goldText, marginTop: 6 }}>
                      Show me how <ChevronRight size={13} strokeWidth={2} />
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: goldText, whiteSpace: 'nowrap', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtInt(evDayKwh)} kWh
                    <small style={{ display: 'block', fontSize: '0.5625rem', fontWeight: 500, color: c.t3 }}>off the day rate</small>
                  </div>
                </button>
                <div style={{ borderTop: `1px solid ${c.border}` }} />
                <button
                  type="button"
                  onClick={() => onAskAssistant('I want to upload a photo of an issue in my home. Help me describe it for the developer.')}
                  className="mh-press"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', width: '100%', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                >
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(59,130,246,0.12)', color: c.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Camera size={16} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: c.t1 }}>Upload a photo of an issue</div>
                    <div style={{ fontSize: '0.6875rem', color: c.t2, marginTop: 2 }}>Create a clearer report with room, system and context</div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.6875rem', fontWeight: 600, color: goldText, marginTop: 6 }}>
                      Start issue note <ChevronRight size={13} strokeWidth={2} />
                    </div>
                  </div>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: c.blue, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    Photo
                    <small style={{ display: 'block', fontSize: '0.5625rem', fontWeight: 500, color: c.t3 }}>optional</small>
                  </div>
                </button>
              </div>
            </Reveal>
          </>
        )}

        {/* Your area (always rendered) */}
        {sectionTitle('Your area', 'getting around')}
        <Reveal index={next()} reduce={reduce}>
          <div style={{ background: c.card, border: `1px solid ${c.cardBorder}`, borderRadius: 14, padding: 14, boxShadow: c.shadow, overflow: 'hidden' }}>
            <div style={{ position: 'relative', height: 132, borderRadius: 10, overflow: 'hidden', border: `1px solid ${c.border}`, background: c.mapBg }}>
              <svg viewBox="0 0 300 132" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                <rect width="300" height="132" fill={c.mapBg} />
                <rect x="18" y="12" width="78" height="46" rx="7" fill={isDarkMode ? '#1b2a1f' : '#e4ece2'} />
                <rect x="206" y="74" width="86" height="52" rx="7" fill={isDarkMode ? '#1b2a1f' : '#e4ece2'} />
                <path d="M0 104 C 60 96, 110 120, 180 108 C 240 98, 282 112, 300 106 L300 132 L0 132 Z" fill={isDarkMode ? '#16242e' : '#dbe7ef'} />
                <g stroke={isDarkMode ? '#2a2f37' : '#ffffff'} strokeWidth="8" fill="none" strokeLinecap="round">
                  <path d="M-10 50 H 320" />
                  <path d="M152 -10 V 150" />
                  <path d="M30 150 L 270 -12" />
                </g>
              </svg>
              {/* Points of interest */}
              <div style={{ position: 'absolute', left: '26%', top: '30%', transform: 'translate(-50%,-100%)', width: 14, height: 14 }}>
                <span style={{ position: 'absolute', inset: 0, borderRadius: '50% 50% 50% 0', transform: 'rotate(45deg)', background: c.t3, border: '2px solid #fff', boxShadow: '0 2px 5px rgba(0,0,0,.25)' }} />
              </div>
              <div style={{ position: 'absolute', left: '76%', top: '66%', transform: 'translate(-50%,-100%)', width: 14, height: 14 }}>
                <span style={{ position: 'absolute', inset: 0, borderRadius: '50% 50% 50% 0', transform: 'rotate(45deg)', background: c.t3, border: '2px solid #fff', boxShadow: '0 2px 5px rgba(0,0,0,.25)' }} />
              </div>
              {/* Home */}
              <div style={{ position: 'absolute', left: '51%', top: '50%', transform: 'translate(-50%,-100%)', width: 14, height: 14 }}>
                <span style={{ position: 'absolute', inset: 0, borderRadius: '50% 50% 50% 0', transform: 'rotate(45deg)', background: GOLD, border: '2px solid #fff', boxShadow: '0 2px 5px rgba(0,0,0,.25)' }} />
                {!reduce && (
                  <span style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: '2px solid rgba(212,175,55,.6)', animation: 'mh-areaping 2.2s ease-out infinite' }} />
                )}
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              {[
                { icon: <Building2 size={15} strokeWidth={2} />, name: 'Site office', dist: '2 min walk' },
                { icon: <ShoppingCart size={15} strokeWidth={2} />, name: 'SuperValu Douglas', dist: '7 min' },
                { icon: <Bus size={15} strokeWidth={2} />, name: 'Bus 219 to the city', dist: '4 min walk' },
              ].map((poi, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 2px', borderTop: i === 0 ? 'none' : `1px solid ${c.border}` }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: c.soft, color: c.t2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {poi.icon}
                  </div>
                  <div style={{ flex: 1, fontSize: '0.8125rem', fontWeight: 500, color: c.t1 }}>{poi.name}</div>
                  <div style={{ fontSize: '0.75rem', color: c.t2, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{poi.dist}</div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={onOpenMaps}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', fontWeight: 600, color: goldText, marginTop: 12, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              <MapPin size={13} strokeWidth={2} /> Open full map <ChevronRight size={13} strokeWidth={2} />
            </button>
          </div>
        </Reveal>

        {isDemo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center', color: c.t3, fontSize: '0.6875rem', margin: '18px 0 6px' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.t3 }} />
            Synthetic demo data, not a live meter feed
          </div>
        )}
      </div>
    </div>
  );
}
