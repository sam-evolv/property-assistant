/**
 * OpenHouse AI Shared Theme System
 *
 * This module provides consistent styling tokens and utilities
 * shared between Super Admin and Developer dashboards.
 *
 * Key Design Principles:
 * - Neutral-based color system for professional look
 * - Brand gold (#F5B800) as primary accent
 * - Consistent spacing, shadows, and radius
 * - Light theme for main content areas
 * - Semantic color system for status indicators
 */

// ============================================================================
// SHARED COLOR TOKENS
// ============================================================================
export const themeColors = {
  // Brand
  brand: {
    50: '#FFFEF5',
    100: '#FEF9E7',
    500: '#F5B800',
    600: '#E5AC00',
    700: '#CC9900',
  },

  // Neutral (shared gray scale)
  neutral: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },

  // Semantic
  success: {
    light: '#ECFDF5',
    main: '#10B981',
    text: '#047857',
  },
  warning: {
    light: '#FFFBEB',
    main: '#F59E0B',
    text: '#B45309',
  },
  error: {
    light: '#FEF2F2',
    main: '#EF4444',
    text: '#B91C1C',
  },
  info: {
    light: '#EFF6FF',
    main: '#3B82F6',
    text: '#1D4ED8',
  },
} as const;

// ============================================================================
// SHARED LAYOUT TOKENS
// ============================================================================
export const layoutTokens = {
  // Page padding
  pagePadding: 'p-8',
  pagePaddingMobile: 'p-6',

  // Max width for content
  maxWidth: 'max-w-7xl',
  maxWidthNarrow: 'max-w-6xl',

  // Card styling
  cardBase: 'bg-white rounded-xl border border-neutral-200',
  cardShadow: 'shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)]',
  cardShadowHover: 'hover:shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)]',

  // Section spacing
  sectionGap: 'gap-6',
  sectionMargin: 'mb-8',
} as const;

// ============================================================================
// SHARED ANIMATION CLASSES
// ============================================================================
export const animationClasses = {
  // Transitions
  transition: 'transition-all duration-150 ease-out',
  transitionFast: 'transition-all duration-100 ease-out',
  transitionSlow: 'transition-all duration-300 ease-out',

  // Loading
  pulse: 'animate-pulse',
  spin: 'animate-spin',

  // Hover effects
  hoverLift: 'hover:-translate-y-0.5 hover:shadow-lg',
  hoverScale: 'hover:scale-[1.02]',
} as const;

// ============================================================================
// PAGE BACKGROUND STYLES
// ============================================================================
export const pageBackgrounds = {
  // Light theme (default for both dashboards)
  light: 'bg-neutral-50 min-h-screen',

  // Card background
  card: 'bg-white',

  // Elevated surface
  elevated: 'bg-white shadow-md',
} as const;

// ============================================================================
// STATUS BADGE MAPPINGS
// ============================================================================
export const statusStyles = {
  healthy: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    border: 'border-emerald-200',
  },
  success: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    border: 'border-emerald-200',
  },
  warning: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    border: 'border-amber-200',
  },
  error: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-500',
    border: 'border-red-200',
  },
  critical: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-500',
    border: 'border-red-200',
  },
  info: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
    border: 'border-blue-200',
  },
  neutral: {
    bg: 'bg-neutral-100',
    text: 'text-neutral-600',
    dot: 'bg-neutral-400',
    border: 'border-neutral-200',
  },
  live: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500 animate-pulse',
    border: 'border-emerald-200',
  },
} as const;

export type StatusType = keyof typeof statusStyles;

// ============================================================================
// METRIC CARD VARIANTS
// ============================================================================
export const metricCardVariants = {
  default: {
    bg: 'bg-white',
    border: 'border-neutral-200',
    iconBg: 'bg-neutral-100',
    iconColor: 'text-neutral-600',
  },
  highlighted: {
    bg: 'bg-gradient-to-br from-brand-50 to-white',
    border: 'border-brand-200',
    iconBg: 'bg-brand-100',
    iconColor: 'text-brand-600',
  },
  success: {
    bg: 'bg-white',
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
  },
  warning: {
    bg: 'bg-white',
    border: 'border-amber-200',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
  danger: {
    bg: 'bg-white',
    border: 'border-red-200',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
  },
} as const;

export type MetricCardVariant = keyof typeof metricCardVariants;

// ============================================================================
// CONSISTENT HEADER STYLES
// ============================================================================
export const headerStyles = {
  // Page title
  title: 'text-2xl font-bold text-neutral-900 tracking-tight',

  // Page subtitle
  subtitle: 'text-sm text-neutral-500 mt-1',

  // Section title
  sectionTitle: 'text-base font-semibold text-neutral-900',

  // Card title
  cardTitle: 'text-sm font-semibold text-neutral-900',
} as const;

// ============================================================================
// BUTTON STYLES (matching premium Button component)
// ============================================================================
export const buttonStyles = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm',
  secondary: 'bg-neutral-900 text-white hover:bg-neutral-800',
  outline: 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50',
  ghost: 'text-neutral-600 hover:bg-neutral-100',
  danger: 'bg-red-500 text-white hover:bg-red-600',

  // Sizes
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',

  // Base
  base: 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/20',
} as const;

// ============================================================================
// DASHBOARD-SPECIFIC CONSTANTS
// ============================================================================
export const dashboardConfig = {
  // Refresh intervals (in ms)
  refreshInterval: {
    fast: 10000,    // 10 seconds (for critical monitoring)
    normal: 30000,  // 30 seconds (default)
    slow: 60000,    // 1 minute (for less critical data)
  },

  // Grid configurations
  gridColumns: {
    stats: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    cards: 'grid-cols-1 lg:grid-cols-2',
    threeCol: 'grid-cols-1 lg:grid-cols-3',
  },

  // Animation durations
  skeletonDuration: 1500,
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get status style classes
 */
export function getStatusClasses(status: StatusType) {
  return statusStyles[status] || statusStyles.neutral;
}

/**
 * Get metric card variant classes
 */
export function getMetricVariantClasses(variant: MetricCardVariant) {
  return metricCardVariants[variant] || metricCardVariants.default;
}

/**
 * Format large numbers with K/M suffix
 */
export function formatCompactNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * Format percentage with optional sign
 */
export function formatPercentage(value: number, showSign = true): string {
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * Get trend color class based on value
 */
export function getTrendColor(value: number, invertColors = false): string {
  if (value === 0) return 'text-neutral-500';
  const isPositive = invertColors ? value < 0 : value > 0;
  return isPositive ? 'text-emerald-600' : 'text-red-500';
}

export default {
  themeColors,
  layoutTokens,
  animationClasses,
  pageBackgrounds,
  statusStyles,
  metricCardVariants,
  headerStyles,
  buttonStyles,
  dashboardConfig,
  getStatusClasses,
  getMetricVariantClasses,
  formatCompactNumber,
  formatPercentage,
  getTrendColor,
};
