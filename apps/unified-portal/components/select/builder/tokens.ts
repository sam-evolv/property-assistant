/**
 * OpenHouse Select Builder — Design Tokens
 * Scoped to the builder dashboard route.
 * Based on the Select dark/gold aesthetic from the implementation brief.
 */

export const colors = {
  bg:        '#0b0c0f',
  surface1:  '#0f1115',
  surface2:  '#12151b',
  surface3:  '#161a22',
  border:    '#1e2531',
  borderHover: 'rgba(212, 175, 55, 0.3)',
  borderGold: 'rgba(212, 175, 55, 0.2)',
  textPrimary:   '#eef2f8',
  textSecondary: '#9ca8bc',
  textMuted:     '#778199',
  gold:      '#D4AF37',
  goldGlow:  'rgba(212, 175, 55, 0.08)',
  green:     '#10B981',
  amber:     '#F59E0B',
  red:       '#EF4444',
  blue:      '#3B82F6',
} as const;

export const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

export const STAGE_LABELS: Record<string, string> = {
  planning:          'Pre-Planning',
  site_prep:         'Site Preparation',
  foundations:        'Foundations',
  superstructure:     'Superstructure',
  roof:              'Roof',
  external_works:     'External Works',
  first_fix:         'First Fix',
  insulation:        'Insulation',
  plastering:        'Plastering',
  second_fix:        'Second Fix',
  kitchen_bathrooms:  'Kitchen & Bathrooms',
  external_finish:    'External Finish',
  snagging:          'Snagging',
  handover:          'Handover',
  complete:          'Complete',
};

export const BUILD_STAGES = [
  'planning', 'site_prep', 'foundations', 'superstructure',
  'roof', 'external_works', 'first_fix', 'insulation',
  'plastering', 'second_fix', 'kitchen_bathrooms',
  'external_finish', 'snagging', 'handover', 'complete',
] as const;

export interface BuilderProject {
  id: string;
  builder_id: string;
  address: string;
  address_line_1: string | null;
  city: string | null;
  eircode: string | null;
  homeowner_name: string | null;
  homeowner_email: string | null;
  homeowner_phone: string | null;
  build_stage: string;
  target_handover_date: string | null;
  actual_handover_date: string | null;
  contract_price: number | null;
  hero_image_url: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function getDaysToHandover(targetDate: string | null): { text: string; color: string; days: number | null } {
  if (!targetDate) return { text: 'No date set', color: colors.textMuted, days: null };
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { text: 'Handover overdue', color: colors.red, days: diff };
  if (diff < 8) return { text: `${diff} days to handover`, color: colors.red, days: diff };
  if (diff <= 30) return { text: `${diff} days to handover`, color: colors.amber, days: diff };
  return { text: `${diff} days to handover`, color: colors.textSecondary, days: diff };
}
