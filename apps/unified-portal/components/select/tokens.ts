/**
 * OpenHouse Select — Design Tokens & Core Utilities
 * Single source of truth for all visual decisions.
 * Generated from approved prototype v4.
 */

// ─── Colour system ────────────────────────────────────────────────────────────
export const C = {
  g:      "#D4AF37",
  gHi:    "#F5D060",
  gLo:    "#7A5A08",
  gGlow:  "rgba(212,175,55,0.32)",
  gFog:   "rgba(212,175,55,0.10)",
  gB:     "rgba(212,175,55,0.18)",
  gB2:    "rgba(212,175,55,0.40)",
  bg:     "#04040A",
  s1:     "#080810",
  s2:     "#0E0E18",
  s3:     "#161622",
  s4:     "#1E1E2C",
  glDark: "rgba(4,4,10,0.88)",
  glMid:  "rgba(8,8,18,0.72)",
  t1:     "#EDE8DE",
  t2:     "#7A7468",
  t3:     "#3E3A34",
  b1:     "rgba(255,255,255,0.050)",
  b2:     "rgba(255,255,255,0.085)",
  b3:     "rgba(255,255,255,0.14)",
  grn:    "#2DC87A",
  blu:    "#4899F0",
  pur:    "#8E78E2",
  amb:    "#F0981A",
} as const;

// ─── Layout constants ─────────────────────────────────────────────────────────
export const APP_W  = 390;
export const APP_H  = 780;
export const TAB_H  = 66;
export const CONTENT_H = APP_H - TAB_H;

// ─── Motion ───────────────────────────────────────────────────────────────────
export const EASE    = "cubic-bezier(0.16,1,0.3,1)";
export const EASE_IN = "cubic-bezier(0.4,0,1,1)";
export const EASE_IO = "cubic-bezier(0.45,0,0.55,1)";

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
export const HANDOVER_DATE = new Date("2024-12-14");

// ─── Icons ────────────────────────────────────────────────────────────────────
export const IC = {
  home:   "M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z",
  spark:  ["M13 2L3 14h9l-1 8 10-12h-9l1-8z"],
  story:  ["M12 8v4l3 3","M3.05 11a9 9 0 1 0 .5-3"],
  docs:   ["M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z","M14 2v6h6","M16 13H8","M16 17H8"],
  shield: ["M12 2l7 4v6c0 4.5-3.5 8.5-7 10-3.5-1.5-7-5.5-7-10V6l7-4z","M9 12l2 2 4-4"],
  solar:  ["M12 2v2","M19.07 4.93l-1.41 1.41","M22 12h-2","M19.07 19.07l-1.41-1.41","M12 20v2","M4.93 19.07l1.41-1.41","M2 12h2","M4.93 4.93l1.41 1.41","M12 7a5 5 0 100 10 5 5 0 000-10z"],
  heat:   ["M12 22a9 9 0 100-18 9 9 0 000 18z","M8 14s1.5 2 4 2 4-2 4-2","M9 9h.01","M15 9h.01"],
  ev:     ["M3 12h18","M3 7l9-4 9 4","M3 17l9 4 9-4"],
  send:   "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  mic:    ["M12 1a3 3 0 013 3v8a3 3 0 01-6 0V4a3 3 0 013-3z","M19 10v2a7 7 0 01-14 0v-2","M12 19v4","M8 23h8"],
  close:  "M18 6L6 18M6 6l12 12",
  check:  "M20 6L9 17l-5-5",
  chevR:  "M9 18l6-6-6-6",
  dl:     ["M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4","M7 10l5 5 5-5","M12 15V3"],
  key:    ["M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"],
  phone:  ["M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"],
} as const;

// ─── Tab definitions ──────────────────────────────────────────────────────────
export const TABS = [
  { id: "home",     icon: IC.home,   label: "Home"     },
  { id: "systems",  icon: IC.solar,  label: "Systems"  },
  { id: "story",    icon: IC.story,  label: "Story"    },
  { id: "docs",     icon: IC.docs,   label: "Docs"     },
  { id: "warranty", icon: IC.shield, label: "Warranty" },
] as const;

export type TabId = typeof TABS[number]["id"];

// ─── Time-of-day sky config ───────────────────────────────────────────────────
export interface SkyConfig {
  name:            "dawn" | "morning" | "afternoon" | "dusk" | "night";
  bg:              string;
  starsOpacity:    number;
  windowGlowBase:  number;
  orbColor:        string;
  horizonGlow:     string;
}

export function getSkyConfig(hr: number = new Date().getHours()): SkyConfig {
  if (hr >= 5 && hr < 7) return {
    name: "dawn",
    bg: `radial-gradient(ellipse 100% 55% at 48% -4%, rgba(212,175,55,0.14) 0%, rgba(180,80,20,0.08) 35%, transparent 65%),
         radial-gradient(ellipse 80% 40% at 50% 100%, rgba(212,100,20,0.06) 0%, transparent 55%),
         linear-gradient(180deg, #120804 0%, #0A0608 40%, #05060E 100%)`,
    starsOpacity: 0.55, windowGlowBase: 0.65,
    orbColor: "rgba(220,120,30,0.04)", horizonGlow: "rgba(212,100,20,0.12)",
  };
  if (hr >= 7 && hr < 12) return {
    name: "morning",
    bg: `radial-gradient(ellipse 100% 50% at 48% -8%, rgba(60,80,120,0.08) 0%, transparent 60%),
         radial-gradient(ellipse 70% 45% at 90% 90%, rgba(212,175,55,0.04) 0%, transparent 55%),
         linear-gradient(180deg, #080C14 0%, #06070F 40%, #040408 100%)`,
    starsOpacity: 0.10, windowGlowBase: 0.0,
    orbColor: "rgba(80,100,160,0.025)", horizonGlow: "rgba(80,100,160,0.05)",
  };
  if (hr >= 12 && hr < 17) return {
    name: "afternoon",
    bg: `radial-gradient(ellipse 90% 50% at 50% -10%, rgba(80,100,150,0.07) 0%, transparent 58%),
         linear-gradient(180deg, #080B12 0%, #05060C 40%, #040408 100%)`,
    starsOpacity: 0.05, windowGlowBase: 0.0,
    orbColor: "rgba(80,100,150,0.018)", horizonGlow: "none",
  };
  if (hr >= 17 && hr < 20) return {
    name: "dusk",
    bg: `radial-gradient(ellipse 100% 55% at 48% -2%, rgba(212,120,30,0.12) 0%, rgba(212,175,55,0.07) 30%, transparent 62%),
         radial-gradient(ellipse 80% 45% at 85% 95%, rgba(180,80,10,0.06) 0%, transparent 55%),
         linear-gradient(180deg, #120A04 0%, #09070E 40%, #050408 100%)`,
    starsOpacity: 0.30, windowGlowBase: 0.45,
    orbColor: "rgba(200,100,20,0.04)", horizonGlow: "rgba(200,100,20,0.14)",
  };
  return {
    name: "night",
    bg: `radial-gradient(ellipse 110% 60% at 48% -4%, rgba(212,175,55,0.09) 0%, transparent 58%),
         radial-gradient(ellipse 80% 55% at 90% 95%, rgba(212,175,55,0.05) 0%, transparent 55%),
         radial-gradient(ellipse 60% 45% at 6% 88%, rgba(50,60,100,0.06) 0%, transparent 55%),
         linear-gradient(172deg, #0D0904 0%, #06060E 40%, #050810 75%, #040408 100%)`,
    starsOpacity: 1.0, windowGlowBase: 1.0,
    orbColor: "rgba(212,175,55,0.032)", horizonGlow: "none",
  };
}

// ─── Days home counter ────────────────────────────────────────────────────────
export function getDaysHome(handover: Date = HANDOVER_DATE): number {
  const ms = Date.now() - handover.getTime();
  return Math.max(1, Math.floor(ms / 86_400_000));
}

// ─── Typography scale ─────────────────────────────────────────────────────────
export const TYPE = {
  display:  { fontSize: 52, fontWeight: 900, letterSpacing: "-0.048em", lineHeight: 0.92 },
  hero:     { fontSize: 56, fontWeight: 900, letterSpacing: "-0.05em",  lineHeight: 0.90 },
  heading:  { fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em" },
  title:    { fontSize: 14, fontWeight: 600 },
  body:     { fontSize: 13.5, lineHeight: 1.65 },
  caption:  { fontSize: 10.5, letterSpacing: "0.01em" },
  overline: { fontSize: 9.5, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase" as const },
  micro:    { fontSize: 8.5, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase" as const },
} as const;

// ─── Border radius ────────────────────────────────────────────────────────────
export const RADIUS = {
  sm:   9,
  md:   13,
  lg:   16,
  xl:   18,
  pill: 22,
  full: 9999,
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────
export const SHADOW = {
  goldGlow:  `0 0 24px rgba(212,175,55,0.32)`,
  goldRing:  `0 0 0 4px rgba(212,175,55,0.12), 0 6px 24px rgba(212,175,55,0.30)`,
  userMsg:   `0 4px 24px rgba(212,175,55,0.28), 0 1px 0 rgba(255,255,255,0.15) inset`,
  aiMsg:     `0 2px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)`,
  card:      `0 4px 32px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.04)`,
  appShell:  `0 40px 100px rgba(0,0,0,0.80), 0 0 0 1px rgba(255,255,255,0.04)`,
} as const;

// ─── Animation keyframes (CSS) ────────────────────────────────────────────────
export const KEYFRAMES = `
  *{-webkit-tap-highlight-color:transparent;box-sizing:border-box;}
  ::-webkit-scrollbar{display:none;}
  @keyframes orb0{from{transform:translate(-50%,-50%)scale(1)}to{transform:translate(-50%,-50%)scale(1.42)}}
  @keyframes orb1{from{transform:translate(-50%,-50%)scale(1.1)}to{transform:translate(-50%,-50%)scale(0.76)}}
  @keyframes orb2{from{transform:translate(-50%,-50%)scale(0.88)}to{transform:translate(-50%,-50%)scale(1.28)}}
  @keyframes livePulse{0%,100%{opacity:1}50%{opacity:0.36}}
  @keyframes badgePulse{
    0%,100%{box-shadow:0 0 18px rgba(212,175,55,0.32),inset 0 1px 0 rgba(255,255,255,0.24),0 2px 8px rgba(0,0,0,0.5)}
    50%{box-shadow:0 0 34px rgba(212,175,55,0.55),inset 0 1px 0 rgba(255,255,255,0.24),0 2px 8px rgba(0,0,0,0.5)}
  }
  @keyframes thinkPulse{0%,100%{box-shadow:0 0 14px rgba(212,175,55,0.22)}50%{box-shadow:0 0 28px rgba(212,175,55,0.45)}}
  @keyframes thinkDot{0%,80%,100%{transform:translateY(0);opacity:.3}40%{transform:translateY(-6px);opacity:1}}
  @keyframes haloPulse{0%,100%{opacity:.6;transform:scale(1)}50%{opacity:.2;transform:scale(1.08)}}
`;
