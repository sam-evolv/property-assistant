/**
 * OpenHouse AI Design System v2.0
 * World-Class Enterprise Design Tokens
 *
 * Following Vercel, Linear, and Stripe design principles:
 * - Distinctive typography (not generic Inter/Roboto)
 * - Cohesive color system with semantic meaning
 * - Purposeful motion and micro-interactions
 * - Premium shadows and depth
 * - Accessibility-first approach (WCAG 2.1 AA)
 */

// ============================================================================
// TYPOGRAPHY
// ============================================================================
export const typography = {
  // Font families - distinctive, not generic
  fonts: {
    display: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    body: '"SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: '"SF Mono", "Fira Code", "Monaco", "Consolas", monospace',
  },

  // Type scale - modular scale 1.2
  scale: {
    '2xs': '0.625rem',   // 10px
    'xs': '0.75rem',     // 12px
    'sm': '0.8125rem',   // 13px
    'base': '0.875rem',  // 14px
    'md': '1rem',        // 16px
    'lg': '1.125rem',    // 18px
    'xl': '1.25rem',     // 20px
    '2xl': '1.5rem',     // 24px
    '3xl': '1.875rem',   // 30px
    '4xl': '2.25rem',    // 36px
    '5xl': '3rem',       // 48px
  },

  // Font weights
  weights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  // Line heights
  leading: {
    none: '1',
    tight: '1.1',
    snug: '1.25',
    normal: '1.5',
    relaxed: '1.625',
    loose: '2',
  },

  // Letter spacing
  tracking: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
} as const;

// ============================================================================
// COLOR SYSTEM
// ============================================================================
export const colors = {
  // Brand colors - The OpenHouse Gold
  brand: {
    50: '#FFFEF5',
    100: '#FEF9E7',
    200: '#FDF0C3',
    300: '#FCE69E',
    400: '#FAD455',
    500: '#F5B800',  // Primary brand gold
    600: '#E5AC00',
    700: '#CC9900',
    800: '#A67C00',
    900: '#7A5C00',
    950: '#4D3A00',
  },

  // Neutral scale - warm grays for premium feel
  neutral: {
    0: '#FFFFFF',
    50: '#FAFAFA',
    100: '#F5F5F5',
    150: '#EEEEEE',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0A0A0A',
  },

  // Semantic colors
  semantic: {
    success: {
      light: '#ECFDF5',
      main: '#10B981',
      dark: '#047857',
      contrast: '#FFFFFF',
    },
    warning: {
      light: '#FFFBEB',
      main: '#F59E0B',
      dark: '#B45309',
      contrast: '#000000',
    },
    error: {
      light: '#FEF2F2',
      main: '#EF4444',
      dark: '#B91C1C',
      contrast: '#FFFFFF',
    },
    info: {
      light: '#EFF6FF',
      main: '#3B82F6',
      dark: '#1D4ED8',
      contrast: '#FFFFFF',
    },
  },

  // Surface colors (light mode)
  surface: {
    page: '#F7F7F8',
    card: '#FFFFFF',
    elevated: '#FFFFFF',
    overlay: 'rgba(0, 0, 0, 0.5)',
    hover: '#FAFAFA',
    pressed: '#F5F5F5',
  },

  // Surface colors (dark mode - for sidebar)
  surfaceDark: {
    page: '#0A0A0A',
    card: '#171717',
    elevated: '#262626',
    hover: '#262626',
    pressed: '#1F1F1F',
    border: '#2E2E2E',
  },

  // Text colors
  text: {
    primary: '#171717',
    secondary: '#525252',
    tertiary: '#737373',
    disabled: '#A3A3A3',
    inverse: '#FFFFFF',
    link: '#F5B800',
    linkHover: '#E5AC00',
  },

  // Border colors
  border: {
    subtle: '#F0F0F0',
    default: '#E5E5E5',
    strong: '#D4D4D4',
    focus: '#F5B800',
    error: '#EF4444',
  },
} as const;

// ============================================================================
// SPACING
// ============================================================================
export const spacing = {
  px: '1px',
  0: '0',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  1.5: '0.375rem',  // 6px
  2: '0.5rem',      // 8px
  2.5: '0.625rem',  // 10px
  3: '0.75rem',     // 12px
  3.5: '0.875rem',  // 14px
  4: '1rem',        // 16px
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  7: '1.75rem',     // 28px
  8: '2rem',        // 32px
  9: '2.25rem',     // 36px
  10: '2.5rem',     // 40px
  11: '2.75rem',    // 44px
  12: '3rem',       // 48px
  14: '3.5rem',     // 56px
  16: '4rem',       // 64px
  20: '5rem',       // 80px
  24: '6rem',       // 96px
  28: '7rem',       // 112px
  32: '8rem',       // 128px
} as const;

// ============================================================================
// BORDERS & RADIUS
// ============================================================================
export const radius = {
  none: '0',
  sm: '0.25rem',    // 4px
  default: '0.375rem', // 6px
  md: '0.5rem',     // 8px
  lg: '0.75rem',    // 12px
  xl: '1rem',       // 16px
  '2xl': '1.5rem',  // 24px
  '3xl': '2rem',    // 32px
  full: '9999px',
} as const;

// ============================================================================
// SHADOWS
// ============================================================================
export const shadows = {
  none: 'none',

  // Subtle shadows for cards
  xs: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
  sm: '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.03)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.03)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.06), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.07), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.15)',

  // Brand shadow with gold glow
  brand: '0 0 0 3px rgba(245, 184, 0, 0.15)',
  brandHover: '0 4px 12px rgba(245, 184, 0, 0.25)',
  brandFocus: '0 0 0 3px rgba(245, 184, 0, 0.3)',

  // Card shadows
  card: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
  cardHover: '0 8px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
  cardElevated: '0 12px 32px rgba(0, 0, 0, 0.1), 0 4px 12px rgba(0, 0, 0, 0.05)',

  // Inner shadow for inputs
  inner: 'inset 0 1px 2px rgba(0, 0, 0, 0.04)',
} as const;

// ============================================================================
// ANIMATION & TRANSITIONS
// ============================================================================
export const animation = {
  // Durations
  duration: {
    instant: '0ms',
    fast: '100ms',
    normal: '150ms',
    moderate: '200ms',
    slow: '300ms',
    slower: '400ms',
    slowest: '500ms',
  },

  // Easings (following Apple's HIG)
  easing: {
    default: 'cubic-bezier(0.2, 0, 0, 1)',
    linear: 'linear',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },

  // Common transitions
  transitions: {
    fast: '100ms cubic-bezier(0.2, 0, 0, 1)',
    normal: '150ms cubic-bezier(0.2, 0, 0, 1)',
    slow: '300ms cubic-bezier(0.2, 0, 0, 1)',
    colors: 'color 150ms, background-color 150ms, border-color 150ms',
    opacity: 'opacity 150ms cubic-bezier(0.2, 0, 0, 1)',
    transform: 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
    all: 'all 150ms cubic-bezier(0.2, 0, 0, 1)',
  },
} as const;

// ============================================================================
// Z-INDEX SCALE
// ============================================================================
export const zIndex = {
  behind: -1,
  base: 0,
  dropdown: 10,
  sticky: 20,
  overlay: 30,
  modal: 40,
  popover: 50,
  tooltip: 60,
  toast: 70,
  max: 9999,
} as const;

// ============================================================================
// BREAKPOINTS
// ============================================================================
export const breakpoints = {
  xs: '475px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// ============================================================================
// COMPONENT TOKENS
// ============================================================================
export const components = {
  // Button styles
  button: {
    height: {
      xs: '1.75rem',   // 28px
      sm: '2rem',      // 32px
      md: '2.25rem',   // 36px
      lg: '2.5rem',    // 40px
      xl: '3rem',      // 48px
    },
    padding: {
      xs: '0 0.5rem',
      sm: '0 0.75rem',
      md: '0 1rem',
      lg: '0 1.25rem',
      xl: '0 1.5rem',
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.8125rem',
      md: '0.875rem',
      lg: '1rem',
      xl: '1.125rem',
    },
  },

  // Input styles
  input: {
    height: {
      sm: '2rem',      // 32px
      md: '2.5rem',    // 40px
      lg: '3rem',      // 48px
    },
    padding: '0 0.75rem',
  },

  // Card styles
  card: {
    padding: {
      sm: '1rem',
      md: '1.25rem',
      lg: '1.5rem',
    },
    radius: '0.75rem',
  },

  // Sidebar
  sidebar: {
    width: '16rem',      // 256px
    widthCollapsed: '4.5rem', // 72px
  },
} as const;

// ============================================================================
// CSS CUSTOM PROPERTIES
// ============================================================================
export const cssVariables = `
:root {
  /* Brand Colors */
  --color-brand-50: ${colors.brand[50]};
  --color-brand-100: ${colors.brand[100]};
  --color-brand-200: ${colors.brand[200]};
  --color-brand-300: ${colors.brand[300]};
  --color-brand-400: ${colors.brand[400]};
  --color-brand-500: ${colors.brand[500]};
  --color-brand-600: ${colors.brand[600]};
  --color-brand-700: ${colors.brand[700]};
  --color-brand-800: ${colors.brand[800]};
  --color-brand-900: ${colors.brand[900]};

  /* Neutral Colors */
  --color-neutral-0: ${colors.neutral[0]};
  --color-neutral-50: ${colors.neutral[50]};
  --color-neutral-100: ${colors.neutral[100]};
  --color-neutral-200: ${colors.neutral[200]};
  --color-neutral-300: ${colors.neutral[300]};
  --color-neutral-400: ${colors.neutral[400]};
  --color-neutral-500: ${colors.neutral[500]};
  --color-neutral-600: ${colors.neutral[600]};
  --color-neutral-700: ${colors.neutral[700]};
  --color-neutral-800: ${colors.neutral[800]};
  --color-neutral-900: ${colors.neutral[900]};
  --color-neutral-950: ${colors.neutral[950]};

  /* Surface Colors */
  --surface-page: ${colors.surface.page};
  --surface-card: ${colors.surface.card};
  --surface-elevated: ${colors.surface.elevated};
  --surface-hover: ${colors.surface.hover};

  /* Text Colors */
  --text-primary: ${colors.text.primary};
  --text-secondary: ${colors.text.secondary};
  --text-tertiary: ${colors.text.tertiary};
  --text-disabled: ${colors.text.disabled};

  /* Border Colors */
  --border-subtle: ${colors.border.subtle};
  --border-default: ${colors.border.default};
  --border-strong: ${colors.border.strong};
  --border-focus: ${colors.border.focus};

  /* Shadows */
  --shadow-xs: ${shadows.xs};
  --shadow-sm: ${shadows.sm};
  --shadow-md: ${shadows.md};
  --shadow-lg: ${shadows.lg};
  --shadow-card: ${shadows.card};
  --shadow-card-hover: ${shadows.cardHover};

  /* Animation */
  --duration-fast: ${animation.duration.fast};
  --duration-normal: ${animation.duration.normal};
  --duration-slow: ${animation.duration.slow};
  --easing-default: ${animation.easing.default};

  /* Typography */
  --font-display: ${typography.fonts.display};
  --font-body: ${typography.fonts.body};
  --font-mono: ${typography.fonts.mono};

  /* Spacing */
  --spacing-1: ${spacing[1]};
  --spacing-2: ${spacing[2]};
  --spacing-3: ${spacing[3]};
  --spacing-4: ${spacing[4]};
  --spacing-6: ${spacing[6]};
  --spacing-8: ${spacing[8]};

  /* Radius */
  --radius-sm: ${radius.sm};
  --radius-md: ${radius.md};
  --radius-lg: ${radius.lg};
  --radius-xl: ${radius.xl};

  /* Component Tokens */
  --sidebar-width: ${components.sidebar.width};
  --sidebar-width-collapsed: ${components.sidebar.widthCollapsed};
}

/* Focus visible styles */
*:focus-visible {
  outline: 2px solid var(--color-brand-500);
  outline-offset: 2px;
}

/* Selection styles */
::selection {
  background-color: var(--color-brand-200);
  color: var(--color-brand-900);
}
`;

// ============================================================================
// UTILITY TYPES
// ============================================================================
export type ColorScale = keyof typeof colors.brand;
export type NeutralScale = keyof typeof colors.neutral;
export type SpacingScale = keyof typeof spacing;
export type RadiusScale = keyof typeof radius;
export type ShadowScale = keyof typeof shadows;
export type FontSize = keyof typeof typography.scale;
export type FontWeight = keyof typeof typography.weights;

// Export the complete design system
export const designSystem = {
  typography,
  colors,
  spacing,
  radius,
  shadows,
  animation,
  zIndex,
  breakpoints,
  components,
  cssVariables,
} as const;

export type DesignSystem = typeof designSystem;
export default designSystem;
