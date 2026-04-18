import type { AgenticSkillEnvelope } from './tools/agentic-skills';

export type { AgenticSkillEnvelope };

export function isAgenticSkillEnvelope(value: unknown): value is AgenticSkillEnvelope {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.skill === 'string' &&
    v.status === 'awaiting_approval' &&
    Array.isArray(v.drafts) &&
    typeof v.meta === 'object' &&
    v.meta !== null
  );
}

export const SKILL_LABELS: Record<
  string,
  { label: string; humanTitle: string; icon: 'mail' | 'calendar' | 'report' | 'home' }
> = {
  chase_aged_contracts: {
    label: 'Chase aged contracts',
    humanTitle: 'Solicitor chase emails',
    icon: 'mail',
  },
  draft_viewing_followup: {
    label: 'Follow up on viewings',
    humanTitle: 'Viewing follow-up emails',
    icon: 'mail',
  },
  weekly_monday_briefing: {
    label: 'Weekly briefing',
    humanTitle: 'This week at a glance',
    icon: 'report',
  },
  draft_lease_renewal: {
    label: 'Lease renewal offers',
    humanTitle: 'Renewal emails to tenants',
    icon: 'home',
  },
  natural_query: {
    label: 'Answer',
    humanTitle: 'Intelligence answer',
    icon: 'report',
  },
  schedule_viewing_draft: {
    label: 'Schedule viewing',
    humanTitle: 'New viewing',
    icon: 'calendar',
  },
};
