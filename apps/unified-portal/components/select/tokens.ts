/**
 * OpenHouse Select — Design Tokens & Core Utilities
 * Single source of truth for all visual decisions.
 * Generated from approved prototype v4.
 *
 * Usage in Claude Code:
 *   import { C, EASE, APP_W, APP_H, TAB_H, getSkyConfig, getDaysHome } from './tokens';
 */

// ─── Colour system ────────────────────────────────────────────────────────────
export const C = {
  // Gold — the primary brand accent. Three-stop metallic gradient.
  g:      "#D4AF37",   // Mid gold — primary brand
  gHi:    "#F5D060",   // Highlight — top of gradients, sparkles
  gLo:    "#7A5A08",   // Shadow — bottom of gradients, depth
  gGlow:  "rgba(212,175,55,0.32)",  // Glow shadow
  gFog:   "rgba(212,175,55,0.10)",  // Ambient fog
  gB:     "rgba(212,175,55,0.18)",  // Subtle border
  gB2:    "rgba(212,175,55,0.40)",  // Active/hover border

  // Dark surfaces — warm-tinted near-black
  bg:     "#04040A",   // True background — deepest layer
  s1:     "#080810",   // Surface 1 — elevated above bg
  s2:     "#0E0E18",   // Surface 2 — cards, panels
  s3:     "#161622",   // Surface 3 — interactive elements
  s4:     "#1E1E2C",   // Surface 4 — hover states, active

  // Glass
  glDark: "rgba(4,4,10,0.88)",     // Dark frosted glass
  glMid:  "rgba(8,8,18,0.72)",     // Mid frosted glass (status pills)

  // Text hierarchy
  t1:     "#EDE8DE",   // Primary text — warm white
  t2:     "#7A7468",   // Secondary text — muted warm grey
  t3:     "#3E3A34",   // Tertiary text — barely visible

  // Borders
  b1:     "rgba(255,255,255,0.050)",  // Hairline border
  b2:     "rgba(255,255,255,0.085)",  // Subtle border
  b3:     "rgba(255,255,255,0.14)",   // Visible border

  // Semantic — system status colours
  grn:    "#2DC87A",   // Success / active / generating
  blu:    "#4899F0",   // Info / heat pump / compliance
  pur:    "#8E78E2",   // EV / special
  amb:    "#F0981A",   // Solar / amber / energy
} as const;

// ─── Layout constants ─────────────────────────────────────────────────────────
export const APP_W  = 390;   // iPhone 14/15 width
export const APP_H  = 780;   // Fixed app height (accounts for prototype iframe)
export const TAB_H  = 66;    // Bottom tab bar height
export const CONTENT_H = APP_H - TAB_H;  // Available content height

// ─── Motion ───────────────────────────────────────────────────────────────────
export const EASE    = "cubic-bezier(0.16,1,0.3,1)";   // Premium spring — primary
export const EASE_IN = "cubic-bezier(0.4,0,1,1)";       // Exiting elements
export const EASE_IO = "cubic-bezier(0.45,0,0.55,1)";   // Repositioning elements

export const DURATION = {
  micro:   100,   // Hover states, toggles
  fast:    200,   // Small transitions
  base:    320,   // Standard transitions
  slide:   380,   // Page slides
  reveal:  600,   // Stagger reveals
  window:  2200,  // Window illumination on home screen
  welcome: 2800,  // Window illumination on welcome screen
} as const;

// ─── Handover date ────────────────────────────────────────────────────────────
// Update per homeowner — drives the "Day N" counter on home screen
export const HANDOVER_DATE = new Date("2024-12-14");

// ─── Time-of-day sky config ───────────────────────────────────────────────────
// Returns atmosphere values based on current hour.
// Used to drive: background gradient, star opacity, window glow, orb colour.
// This is the mechanism behind Calm's "live background" aesthetic.

export interface SkyConfig {
  name:            "dawn" | "morning" | "afternoon" | "dusk" | "night";
  bg:              string;   // CSS background value (multi-layer gradient)
  starsOpacity:    number;   // 0–1 — how visible the star field is
  windowGlowBase:  number;   // 0–1 — base window illumination level
  orbColor:        string;   // RGBA of ambient breathing orbs
  horizonGlow:     string;   // RGBA of horizon line glow ("none" if absent)
}

export function getSkyConfig(hr: number = new Date().getHours()): SkyConfig {
  // Dawn 5–7am: pre-sunrise warmth, windows still lit
  if (hr >= 5 && hr < 7) return {
    name: "dawn",
    bg: `
      radial-gradient(ellipse 100% 55% at 48% -4%, rgba(212,175,55,0.14) 0%, rgba(180,80,20,0.08) 35%, transparent 65%),
      radial-gradient(ellipse 80% 40% at 50% 100%, rgba(212,100,20,0.06) 0%, transparent 55%),
      linear-gradient(180deg, #120804 0%, #0A0608 40%, #05060E 100%)
    `,
    starsOpacity:   0.55,
    windowGlowBase: 0.65,
    orbColor:       "rgba(220,120,30,0.04)",
    horizonGlow:    "rgba(212,100,20,0.12)",
  };

  // Morning 7am–noon: cool blue-grey light, windows off
  if (hr >= 7 && hr < 12) return {
    name: "morning",
    bg: `
      radial-gradient(ellipse 100% 50% at 48% -8%, rgba(60,80,120,0.08) 0%, transparent 60%),
      radial-gradient(ellipse 70% 45% at 90% 90%, rgba(212,175,55,0.04) 0%, transparent 55%),
      linear-gradient(180deg, #080C14 0%, #06070F 40%, #040408 100%)
    `,
    starsOpacity:   0.10,
    windowGlowBase: 0.0,
    orbColor:       "rgba(80,100,160,0.025)",
    horizonGlow:    "rgba(80,100,160,0.05)",
  };

  // Afternoon noon–5pm: neutral dark, no stars, windows off
  if (hr >= 12 && hr < 17) return {
    name: "afternoon",
    bg: `
      radial-gradient(ellipse 90% 50% at 50% -10%, rgba(80,100,150,0.07) 0%, transparent 58%),
      linear-gradient(180deg, #080B12 0%, #05060C 40%, #040408 100%)
    `,
    starsOpacity:   0.05,
    windowGlowBase: 0.0,
    orbColor:       "rgba(80,100,150,0.018)",
    horizonGlow:    "none",
  };

  // Dusk 5–8pm: amber warmth, windows warming up at 45%
  if (hr >= 17 && hr < 20) return {
    name: "dusk",
    bg: `
      radial-gradient(ellipse 100% 55% at 48% -2%, rgba(212,120,30,0.12) 0%, rgba(212,175,55,0.07) 30%, transparent 62%),
      radial-gradient(ellipse 80% 45% at 85% 95%, rgba(180,80,10,0.06) 0%, transparent 55%),
      linear-gradient(180deg, #120A04 0%, #09070E 40%, #050408 100%)
    `,
    starsOpacity:   0.30,
    windowGlowBase: 0.45,
    orbColor:       "rgba(200,100,20,0.04)",
    horizonGlow:    "rgba(200,100,20,0.14)",
  };

  // Night 8pm–5am: full dark, stars out, windows fully lit
  return {
    name: "night",
    bg: `
      radial-gradient(ellipse 110% 60% at 48% -4%, rgba(212,175,55,0.09) 0%, transparent 58%),
      radial-gradient(ellipse 80% 55% at 90% 95%, rgba(212,175,55,0.05) 0%, transparent 55%),
      radial-gradient(ellipse 60% 45% at 6% 88%, rgba(50,60,100,0.06) 0%, transparent 55%),
      linear-gradient(172deg, #0D0904 0%, #06060E 40%, #050810 75%, #040408 100%)
    `,
    starsOpacity:   1.0,
    windowGlowBase: 1.0,
    orbColor:       "rgba(212,175,55,0.032)",
    horizonGlow:    "none",
  };
}

// ─── Days home counter ────────────────────────────────────────────────────────
// Returns integer days since handover. Minimum 1.
// This number is displayed as "Day N" on the home screen.
// Emotional anchor — grows silently every day.
export function getDaysHome(handover: Date = HANDOVER_DATE): number {
  const ms = Date.now() - handover.getTime();
  return Math.max(1, Math.floor(ms / 86_400_000));
}

// ─── Tab definitions ──────────────────────────────────────────────────────────
// Order is intentional — Home first, Warranty last (journey arc)
export const TABS = [
  { id: "home",     label: "Home"     },
  { id: "systems",  label: "Systems"  },
  { id: "story",    label: "Story"    },
  { id: "docs",     label: "Docs"     },
  { id: "warranty", label: "Warranty" },
] as const;

export type TabId = typeof TABS[number]["id"];

// ─── Typography scale ─────────────────────────────────────────────────────────
// All type decisions from the approved prototype.
export const TYPE = {
  // Display — home screen address, welcome screen name
  display: { fontSize: 52, fontWeight: 900, letterSpacing: "-0.048em", lineHeight: 0.92 },
  // Hero — welcome screen "Sarah."
  hero:    { fontSize: 56, fontWeight: 900, letterSpacing: "-0.05em",  lineHeight: 0.90 },
  // Section headings — Systems, Story, Docs, Warranty
  heading: { fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em"  },
  // Card titles — system names, warranty items
  title:   { fontSize: 14, fontWeight: 600 },
  // Body text — descriptions, subtitles
  body:    { fontSize: 13.5, lineHeight: 1.65 },
  // Caption — dates, labels, sub-metadata
  caption: { fontSize: 10.5, letterSpacing: "0.01em" },
  // Overline — section category labels
  overline: { fontSize: 9.5, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase" as const },
  // Micro — tab labels, badge text
  micro:   { fontSize: 8.5, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase" as const },
} as const;

// ─── Border radius ────────────────────────────────────────────────────────────
export const RADIUS = {
  sm:   9,   // Doc icons, small badges
  md:   13,  // List rows, warranty items
  lg:   16,  // App shell, welcome screen
  xl:   18,  // Cards, system panels
  pill: 22,  // Status pills, chips
  full: 9999, // Circular elements (use borderRadius: "50%" instead)
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
// Paste into a global <style> tag or CSS module.
export const KEYFRAMES = `
  @keyframes orb0 { from{transform:translate(-50%,-50%)scale(1)} to{transform:translate(-50%,-50%)scale(1.42)} }
  @keyframes orb1 { from{transform:translate(-50%,-50%)scale(1.1)} to{transform:translate(-50%,-50%)scale(0.76)} }
  @keyframes orb2 { from{transform:translate(-50%,-50%)scale(0.88)} to{transform:translate(-50%,-50%)scale(1.28)} }
  @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.36} }
  @keyframes badgePulse {
    0%,100%{box-shadow:0 0 18px rgba(212,175,55,0.32),inset 0 1px 0 rgba(255,255,255,0.24),0 2px 8px rgba(0,0,0,0.5)}
    50%   {box-shadow:0 0 34px rgba(212,175,55,0.55),inset 0 1px 0 rgba(255,255,255,0.24),0 2px 8px rgba(0,0,0,0.5)}
  }
  @keyframes thinkPulse { 0%,100%{box-shadow:0 0 14px rgba(212,175,55,0.22)} 50%{box-shadow:0 0 28px rgba(212,175,55,0.45)} }
  @keyframes thinkDot   { 0%,80%,100%{transform:translateY(0);opacity:.3} 40%{transform:translateY(-6px);opacity:1} }
  @keyframes haloPulse  { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:.2;transform:scale(1.08)} }
`;
