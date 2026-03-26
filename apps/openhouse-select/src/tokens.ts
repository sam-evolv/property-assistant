/**
 * OpenHouse Select — Design Tokens & Core Utilities
 * Single source of truth for all visual decisions.
 * Generated from approved prototype v4.
 *
 * Usage:
 *   import { C, EASE, APP_W, APP_H, TAB_H, getSkyConfig, getDaysHome } from './tokens';
 */
import { Dimensions, Platform } from 'react-native';

// ─── Colour system ────────────────────────────────────────────────────────────
export const C = {
  // Gold — the primary brand accent. Three-stop metallic gradient.
  g:      '#D4AF37',
  gHi:    '#F5D060',
  gLo:    '#7A5A08',
  gGlow:  'rgba(212,175,55,0.32)',
  gFog:   'rgba(212,175,55,0.10)',
  gB:     'rgba(212,175,55,0.18)',
  gB2:    'rgba(212,175,55,0.40)',

  // Dark surfaces — warm-tinted near-black
  bg:     '#04040A',
  s1:     '#080810',
  s2:     '#0E0E18',
  s3:     '#161622',
  s4:     '#1E1E2C',

  // Glass
  glDark: 'rgba(4,4,10,0.88)',
  glMid:  'rgba(8,8,18,0.72)',

  // Text hierarchy
  t1:     '#EDE8DE',
  t2:     '#7A7468',
  t3:     '#3E3A34',

  // Borders
  b1:     'rgba(255,255,255,0.050)',
  b2:     'rgba(255,255,255,0.085)',
  b3:     'rgba(255,255,255,0.14)',

  // Semantic — system status colours
  grn:    '#2DC87A',
  blu:    '#4899F0',
  pur:    '#8E78E2',
  amb:    '#F0981A',
} as const;

// ─── Layout constants ─────────────────────────────────────────────────────────
export const APP_W  = 390;
export const APP_H  = 780;
export const TAB_H  = 66;
export const CONTENT_H = APP_H - TAB_H;

const { width: SCREEN_W } = Dimensions.get('window');
export const SCALE = SCREEN_W / APP_W;

// ─── Motion ───────────────────────────────────────────────────────────────────
export const EASE    = 'cubic-bezier(0.16,1,0.3,1)';
export const EASE_IN = 'cubic-bezier(0.4,0,1,1)';
export const EASE_IO = 'cubic-bezier(0.45,0,0.55,1)';

export const DURATION = {
  micro:   100,
  fast:    200,
  base:    320,
  slide:   380,
  reveal:  600,
  window:  2200,
  welcome: 2800,
} as const;

// ─── Handover date ────────────────────────────────────────────────────────────
export const HANDOVER_DATE = new Date('2024-12-14');

// ─── Time-of-day sky config ───────────────────────────────────────────────────
export interface SkyConfig {
  name:            'dawn' | 'morning' | 'afternoon' | 'dusk' | 'night';
  starsOpacity:    number;
  windowGlowBase:  number;
  // Gradient stops for LinearGradient in RN
  bgStops:         { colors: string[]; locations?: number[] };
  orbColor:        string;
}

export function getSkyConfig(hr: number = new Date().getHours()): SkyConfig {
  if (hr >= 5 && hr < 7) return {
    name: 'dawn',
    starsOpacity:   0.55,
    windowGlowBase: 0.65,
    bgStops:        { colors: ['#120804', '#0A0608', '#05060E'], locations: [0, 0.4, 1] },
    orbColor:       'rgba(220,120,30,0.04)',
  };
  if (hr >= 7 && hr < 12) return {
    name: 'morning',
    starsOpacity:   0.10,
    windowGlowBase: 0.0,
    bgStops:        { colors: ['#080C14', '#06070F', '#040408'], locations: [0, 0.4, 1] },
    orbColor:       'rgba(80,100,160,0.025)',
  };
  if (hr >= 12 && hr < 17) return {
    name: 'afternoon',
    starsOpacity:   0.05,
    windowGlowBase: 0.0,
    bgStops:        { colors: ['#080B12', '#05060C', '#040408'], locations: [0, 0.4, 1] },
    orbColor:       'rgba(80,100,150,0.018)',
  };
  if (hr >= 17 && hr < 20) return {
    name: 'dusk',
    starsOpacity:   0.30,
    windowGlowBase: 0.45,
    bgStops:        { colors: ['#120A04', '#09070E', '#050408'], locations: [0, 0.4, 1] },
    orbColor:       'rgba(200,100,20,0.04)',
  };
  return {
    name: 'night',
    starsOpacity:   1.0,
    windowGlowBase: 1.0,
    bgStops:        { colors: ['#0D0904', '#06060E', '#050810', '#040408'], locations: [0, 0.4, 0.75, 1] },
    orbColor:       'rgba(212,175,55,0.032)',
  };
}

// ─── Days home counter ────────────────────────────────────────────────────────
export function getDaysHome(handover: Date = HANDOVER_DATE): number {
  const ms = Date.now() - handover.getTime();
  return Math.max(1, Math.floor(ms / 86_400_000));
}

// ─── Tab definitions ──────────────────────────────────────────────────────────
export const TABS = [
  { id: 'home',     label: 'Home'     },
  { id: 'systems',  label: 'Systems'  },
  { id: 'story',    label: 'Story'    },
  { id: 'docs',     label: 'Docs'     },
  { id: 'warranty', label: 'Warranty' },
] as const;

export type TabId = typeof TABS[number]['id'];

// ─── Typography scale ─────────────────────────────────────────────────────────
export const TYPE = {
  display:  { fontSize: 52, fontWeight: '900' as const, letterSpacing: -2.5, lineHeight: 48 },
  hero:     { fontSize: 56, fontWeight: '900' as const, letterSpacing: -2.8, lineHeight: 50 },
  heading:  { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.8 },
  title:    { fontSize: 14, fontWeight: '600' as const },
  body:     { fontSize: 13.5, lineHeight: 22 },
  caption:  { fontSize: 10.5, letterSpacing: 0.1 },
  overline: { fontSize: 9.5, fontWeight: '800' as const, letterSpacing: 2.1, textTransform: 'uppercase' as const },
  micro:    { fontSize: 8.5, fontWeight: '800' as const, letterSpacing: 0.85, textTransform: 'uppercase' as const },
} as const;

// ─── Border radius ────────────────────────────────────────────────────────────
export const RADIUS = {
  sm:   9,
  md:   13,
  lg:   16,
  xl:   18,
  pill: 22,
} as const;

// ─── Icon paths (SVG d attributes) ───────────────────────────────────────────
export const IC = {
  home:   ['M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z'],
  spark:  ['M13 2L3 14h9l-1 8 10-12h-9l1-8z'],
  story:  ['M12 8v4l3 3', 'M3.05 11a9 9 0 1 0 .5-3'],
  docs:   ['M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8'],
  shield: ['M12 2l7 4v6c0 4.5-3.5 8.5-7 10-3.5-1.5-7-5.5-7-10V6l7-4z', 'M9 12l2 2 4-4'],
  solar:  ['M12 2v2', 'M19.07 4.93l-1.41 1.41', 'M22 12h-2', 'M19.07 19.07l-1.41-1.41', 'M12 20v2', 'M4.93 19.07l1.41-1.41', 'M2 12h2', 'M4.93 4.93l1.41 1.41', 'M12 7a5 5 0 100 10 5 5 0 000-10z'],
  heat:   ['M12 22a9 9 0 100-18 9 9 0 000 18z', 'M8 14s1.5 2 4 2 4-2 4-2', 'M9 9h.01', 'M15 9h.01'],
  ev:     ['M3 12h18', 'M3 7l9-4 9 4', 'M3 17l9 4 9-4'],
  send:   ['M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z'],
  mic:    ['M12 1a3 3 0 013 3v8a3 3 0 01-6 0V4a3 3 0 013-3z', 'M19 10v2a7 7 0 01-14 0v-2', 'M12 19v4', 'M8 23h8'],
  close:  ['M18 6L6 18M6 6l12 12'],
  check:  ['M20 6L9 17l-5-5'],
  chevR:  ['M9 18l6-6-6-6'],
  dl:     ['M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  key:    ['M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4'],
  phone:  ['M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z'],
} as const;
