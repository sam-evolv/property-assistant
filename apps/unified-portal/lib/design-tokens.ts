/**
 * OpenHouse Design System Tokens
 * World-class UI/UX design tokens following billion-dollar SaaS standards
 *
 * @description These tokens form the foundation of the OpenHouse design system.
 * Every component should reference these tokens for consistency.
 */

export const tokens = {
  colors: {
    // Backgrounds
    bg: {
      page: '#f5f5f5',           // Main page background
      card: '#ffffff',           // Card/panel backgrounds
      subtle: '#f9f9f9',         // Subtle backgrounds
      hover: '#fafafa',          // Hover states
    },
    // Borders
    border: {
      light: '#f0f0f0',          // Very subtle dividers
      default: '#e5e5e5',        // Standard borders
      hover: '#d0d0d0',          // Hover state borders
    },
    // Text
    text: {
      primary: '#1a1a1a',        // Headings, primary content
      secondary: '#666666',      // Body text, descriptions
      muted: '#999999',          // Captions, hints, labels
    },
    // Accent (The OpenHouse Gold)
    accent: {
      amber: '#f5b800',          // Primary brand color
      amberHover: '#e5ac00',     // Hover state
      amberLight: '#fef9e7',     // Light background tint
      amberBorder: 'rgba(245, 184, 0, 0.3)',
    },
    // Status Colors
    status: {
      success: '#10b981',
      successLight: '#ecfdf5',
      error: '#ef4444',
      errorLight: '#fef2f2',
      warning: '#f59e0b',
      warningLight: '#fffbeb',
      info: '#3b82f6',
      infoLight: '#eff6ff',
    },
    // Sidebar (Dark theme - unchanged)
    sidebar: {
      bg: '#0a0a0a',
      text: '#ffffff',
      muted: '#888888',
      active: 'rgba(245, 184, 0, 0.1)',
      activeBorder: '#f5b800',
    },
  },

  typography: {
    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',

    // Hierarchy
    heading1: { size: '24px', weight: 600, lineHeight: '1.2' },
    heading2: { size: '20px', weight: 600, lineHeight: '1.3' },
    heading3: { size: '16px', weight: 600, lineHeight: '1.4' },
    heading4: { size: '14px', weight: 600, lineHeight: '1.4' },

    body: { size: '13px', weight: 400, lineHeight: '1.6' },
    bodyMedium: { size: '13px', weight: 500, lineHeight: '1.6' },

    label: {
      size: '11px',
      weight: 600,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.04em',
    },

    caption: { size: '12px', weight: 400, lineHeight: '1.4' },

    stat: { size: '28px', weight: 600, letterSpacing: '-0.02em' },
  },

  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    xxl: '24px',
    xxxl: '32px',
  },

  radius: {
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },

  shadow: {
    sm: '0 1px 2px rgba(0,0,0,0.04)',
    md: '0 2px 8px rgba(0,0,0,0.06)',
    lg: '0 4px 16px rgba(0,0,0,0.08)',
    card: '0 1px 3px rgba(0,0,0,0.04)',
    cardHover: '0 4px 12px rgba(0,0,0,0.08)',
  },

  animation: {
    fast: '150ms ease',
    normal: '200ms ease',
    slow: '300ms ease',
  },
} as const;

// CSS Custom Properties for use in Tailwind and components
export const cssVariables = `
  :root {
    /* Backgrounds */
    --bg-page: ${tokens.colors.bg.page};
    --bg-card: ${tokens.colors.bg.card};
    --bg-subtle: ${tokens.colors.bg.subtle};
    --bg-hover: ${tokens.colors.bg.hover};

    /* Borders */
    --border-light: ${tokens.colors.border.light};
    --border-default: ${tokens.colors.border.default};
    --border-hover: ${tokens.colors.border.hover};

    /* Text */
    --text-primary: ${tokens.colors.text.primary};
    --text-secondary: ${tokens.colors.text.secondary};
    --text-muted: ${tokens.colors.text.muted};

    /* Accent */
    --accent-amber: ${tokens.colors.accent.amber};
    --accent-amber-hover: ${tokens.colors.accent.amberHover};
    --accent-amber-light: ${tokens.colors.accent.amberLight};

    /* Status */
    --status-success: ${tokens.colors.status.success};
    --status-success-light: ${tokens.colors.status.successLight};
    --status-error: ${tokens.colors.status.error};
    --status-error-light: ${tokens.colors.status.errorLight};
    --status-warning: ${tokens.colors.status.warning};
    --status-warning-light: ${tokens.colors.status.warningLight};
    --status-info: ${tokens.colors.status.info};
    --status-info-light: ${tokens.colors.status.infoLight};

    /* Sidebar */
    --sidebar-bg: ${tokens.colors.sidebar.bg};
    --sidebar-text: ${tokens.colors.sidebar.text};
    --sidebar-muted: ${tokens.colors.sidebar.muted};

    /* Shadows */
    --shadow-sm: ${tokens.shadow.sm};
    --shadow-md: ${tokens.shadow.md};
    --shadow-lg: ${tokens.shadow.lg};
    --shadow-card: ${tokens.shadow.card};

    /* Spacing */
    --spacing-xs: ${tokens.spacing.xs};
    --spacing-sm: ${tokens.spacing.sm};
    --spacing-md: ${tokens.spacing.md};
    --spacing-lg: ${tokens.spacing.lg};
    --spacing-xl: ${tokens.spacing.xl};

    /* Radius */
    --radius-sm: ${tokens.radius.sm};
    --radius-md: ${tokens.radius.md};
    --radius-lg: ${tokens.radius.lg};
    --radius-xl: ${tokens.radius.xl};

    /* Animation */
    --animation-fast: ${tokens.animation.fast};
    --animation-normal: ${tokens.animation.normal};
    --animation-slow: ${tokens.animation.slow};
  }
`;

// Tailwind-compatible color classes
export const tailwindExtend = {
  colors: {
    'oh-page': tokens.colors.bg.page,
    'oh-card': tokens.colors.bg.card,
    'oh-subtle': tokens.colors.bg.subtle,
    'oh-border': tokens.colors.border.default,
    'oh-border-light': tokens.colors.border.light,
    'oh-text': tokens.colors.text.primary,
    'oh-text-secondary': tokens.colors.text.secondary,
    'oh-text-muted': tokens.colors.text.muted,
    'oh-amber': tokens.colors.accent.amber,
    'oh-amber-hover': tokens.colors.accent.amberHover,
    'oh-amber-light': tokens.colors.accent.amberLight,
  },
};

export type DesignTokens = typeof tokens;
