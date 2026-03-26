/** Design tokens for OpenHouse Select tier */

export const SELECT_COLORS = {
  background: '#04040A',
  surface: '#0A0A14',
  surfaceElevated: '#12121E',
  gold: '#D4AF37',
  goldMuted: '#B8972F',
  goldLight: '#E8C84A',
  text: '#FFFFFF',
  textSecondary: '#A0A0B0',
  border: '#1E1E2E',
  borderGold: 'rgba(212, 175, 55, 0.3)',
} as const;

export const SELECT_FONTS = {
  heading: '"Inter", system-ui, sans-serif',
  body: '"Inter", system-ui, sans-serif',
} as const;

export const SELECT_SPACING = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
} as const;

export const SELECT_RADII = {
  sm: '6px',
  md: '10px',
  lg: '16px',
  full: '9999px',
} as const;
