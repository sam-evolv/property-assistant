/**
 * Autonomy policy — Session 3.
 *
 * Centralises the rules that govern whether a given draft can be auto-sent:
 *   - statutory exclusion list (hard-coded, never auto-send)
 *   - eligibility thresholds (total_sent >= 20, as_generated_rate >= 0.8, etc.)
 *   - active-hours check in the user's local timezone
 *   - confidence-floor check (< 0.7 on any required field = review mode)
 *   - trust-floor self-correction (2+ undone in last 10 auto-sends => revert)
 *
 * Both the track-record API and the send-draft route import from here so
 * autonomy decisions stay consistent across the stack.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const GLOBAL_PAUSE_DRAFT_TYPE = '_global_pause';

export const STATUTORY_DRAFT_TYPES: readonly string[] = [
  'draft_notice_of_termination',
  'draft_rpz_notice',
  'draft_rtb_dispute_response',
  'draft_hap_landlord_undertaking',
  'draft_arrears_letter',
  'draft_deposit_dispute_response',
] as const;

/**
 * Normalises draft-type identifiers so the statutory check works whether the
 * caller passes the tool-use name (draft_vendor_update) or the persisted
 * pending_drafts.draft_type value (vendor_update).
 */
function normaliseDraftType(draftType: string): string {
  return draftType.startsWith('draft_') ? draftType : `draft_${draftType}`;
}

export const ELIGIBILITY_RULES = {
  minTotalSent: 20,
  minAsGeneratedRate: 0.8,
  maxUndoneRate: 0.05,
  maxDaysSinceLastSend: 14,
  offerDismissalCooldownDays: 30,
  offerDismissalCooldownSends: 10,
  maxOfferDismissals: 3,
  autoSendCountdownSeconds: 10,
  activeHoursStart: 8,
  activeHoursEnd: 21,
  trustFloorWindow: 10,
  trustFloorUndoneThreshold: 2,
} as const;

export interface DraftTypeStats {
  draftType: string;
  totalSent: number;
  sentAsGenerated: number;
  sentEdited: number;
  undoneCount: number;
  asGeneratedRate: number;
  undoneRate: number;
  lastSentAt: string | null;
  eligibleForAutoSend: boolean;
  autoSendEnabled: boolean;
  statutory: boolean;
  eligibilityMessage: string;
  offerDismissedCount: number;
  offeredAt: string | null;
}

export interface SendHistoryRow {
  id: string;
  user_id: string;
  draft_type: string;
  was_edited_before_send: boolean;
  undone: boolean;
  sent_at: string;
  send_mode?: string;
}

export function isStatutoryDraftType(draftType: string): boolean {
  const normalised = normaliseDraftType(draftType);
  return STATUTORY_DRAFT_TYPES.includes(normalised);
}

/**
 * Evaluate eligibility for a given draft_type given that user's send history.
 * Statutory types short-circuit: never eligible regardless of history.
 */
export function computeEligibility(
  draftType: string,
  rows: SendHistoryRow[],
  now: Date = new Date(),
): Omit<DraftTypeStats, 'autoSendEnabled' | 'offerDismissedCount' | 'offeredAt'> {
  const statutory = isStatutoryDraftType(draftType);
  const totalSent = rows.length;
  const sentAsGenerated = rows.filter((r) => !r.was_edited_before_send).length;
  const sentEdited = totalSent - sentAsGenerated;
  const undoneCount = rows.filter((r) => r.undone).length;
  const asGeneratedRate = totalSent > 0 ? sentAsGenerated / totalSent : 0;
  const undoneRate = totalSent > 0 ? undoneCount / totalSent : 0;
  const lastSentAt =
    rows.length > 0
      ? rows.reduce((acc, r) => (r.sent_at > acc ? r.sent_at : acc), rows[0].sent_at)
      : null;

  const daysSinceLastSend = lastSentAt
    ? (now.getTime() - new Date(lastSentAt).getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;

  let eligible = false;
  let message = '';

  if (statutory) {
    message = 'Statutory documents always require your review.';
  } else if (totalSent < ELIGIBILITY_RULES.minTotalSent) {
    const remaining = ELIGIBILITY_RULES.minTotalSent - totalSent;
    message = `Need ${remaining} more send${remaining === 1 ? '' : 's'} to unlock.`;
  } else if (asGeneratedRate < ELIGIBILITY_RULES.minAsGeneratedRate) {
    message = 'Still editing these often. Auto-send unlocks at 80% sent without edits.';
  } else if (undoneRate > ELIGIBILITY_RULES.maxUndoneRate) {
    message = 'A few recent sends were pulled back. Build the streak up and we will offer auto-send again.';
  } else if (daysSinceLastSend > ELIGIBILITY_RULES.maxDaysSinceLastSend) {
    message = 'No recent sends. Send one in the next 14 days to reactivate auto-send.';
  } else {
    eligible = true;
    message = 'You can turn on auto-send for this type.';
  }

  return {
    draftType,
    totalSent,
    sentAsGenerated,
    sentEdited,
    undoneCount,
    asGeneratedRate,
    undoneRate,
    lastSentAt,
    eligibleForAutoSend: eligible,
    statutory,
    eligibilityMessage: message,
  };
}

/**
 * Can the offer be shown right now?
 * True only if: eligible, not already enabled, under the dismissal cap, and
 * past the cooldown since the last dismissal.
 */
export function canOfferAutoSend(
  stats: Omit<DraftTypeStats, 'autoSendEnabled' | 'offerDismissedCount' | 'offeredAt'>,
  pref: {
    autoSendEnabled: boolean;
    offerDismissedCount: number;
    offeredAt: string | null;
    sendsSinceOffer: number;
  },
  now: Date = new Date(),
): boolean {
  if (!stats.eligibleForAutoSend) return false;
  if (pref.autoSendEnabled) return false;
  if (pref.offerDismissedCount >= ELIGIBILITY_RULES.maxOfferDismissals) return false;

  if (pref.offeredAt) {
    const days = (now.getTime() - new Date(pref.offeredAt).getTime()) / (1000 * 60 * 60 * 24);
    if (
      days < ELIGIBILITY_RULES.offerDismissalCooldownDays &&
      pref.sendsSinceOffer < ELIGIBILITY_RULES.offerDismissalCooldownSends
    ) {
      return false;
    }
  }

  return true;
}

/**
 * 8am–9pm local time. IANA timezone names are parsed via Intl.DateTimeFormat,
 * which Node 18+ supports without extra data.
 */
export function isWithinActiveHours(timezone: string, now: Date = new Date()): boolean {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone || 'Europe/Dublin',
      hour: 'numeric',
      hour12: false,
    });
    const hour = parseInt(fmt.format(now), 10);
    return (
      hour >= ELIGIBILITY_RULES.activeHoursStart &&
      hour < ELIGIBILITY_RULES.activeHoursEnd
    );
  } catch {
    return true; // Fail open — better to send late than to silently hold.
  }
}

/**
 * Auto-send is blocked when any required field on the extracted action
 * scored below the confidence threshold. This mirrors the amber-underline
 * treatment in the Session 1 confirmation card.
 */
export function hasLowConfidenceField(
  confidence: Record<string, number> | null | undefined,
  requiredFields: readonly string[],
): boolean {
  if (!confidence) return false;
  for (const field of requiredFields) {
    const score = confidence[field];
    if (typeof score === 'number' && score < 0.7) return true;
  }
  return false;
}

export type AutoSendBlockReason =
  | 'statutory'
  | 'paused'
  | 'low_confidence'
  | 'outside_active_hours'
  | 'not_enabled'
  | 'trust_floor_recent_undos';

export interface AutoSendDecision {
  autoSend: boolean;
  reason?: AutoSendBlockReason;
  holdCopy?: string;
}

interface DecisionInputs {
  draftType: string;
  autoSendEnabled: boolean;
  globalPaused: boolean;
  confidence?: Record<string, number> | null;
  requiredFields: readonly string[];
  timezone: string;
  recentAutoSends: SendHistoryRow[]; // newest first, last N=10
  now?: Date;
}

/**
 * Single decision point the approve flow calls before firing an auto-send.
 * Returns autoSend=false with a machine-readable reason + user-facing copy
 * whenever any gate trips.
 */
export function decideAutoSend(input: DecisionInputs): AutoSendDecision {
  const now = input.now || new Date();

  if (isStatutoryDraftType(input.draftType)) {
    return {
      autoSend: false,
      reason: 'statutory',
      holdCopy: 'Statutory documents always require your review.',
    };
  }

  if (input.globalPaused) {
    return {
      autoSend: false,
      reason: 'paused',
      holdCopy: 'Auto-send is paused. This went to Drafts for review.',
    };
  }

  if (!input.autoSendEnabled) {
    return { autoSend: false, reason: 'not_enabled' };
  }

  if (hasLowConfidenceField(input.confidence, input.requiredFields)) {
    return {
      autoSend: false,
      reason: 'low_confidence',
      holdCopy: 'Held for review. Some details looked uncertain.',
    };
  }

  if (!isWithinActiveHours(input.timezone, now)) {
    return {
      autoSend: false,
      reason: 'outside_active_hours',
      holdCopy: 'Held for morning. Outside your active hours.',
    };
  }

  const recent = input.recentAutoSends.slice(0, ELIGIBILITY_RULES.trustFloorWindow);
  const undone = recent.filter((r) => r.undone).length;
  if (undone >= ELIGIBILITY_RULES.trustFloorUndoneThreshold) {
    return {
      autoSend: false,
      reason: 'trust_floor_recent_undos',
      holdCopy: 'Switched back to review. A couple of recent auto-sends needed pulling back.',
    };
  }

  return { autoSend: true };
}

/**
 * Server-side helper to pull the user's preference rows in one go.
 * Always returns a map so consumers can do `map[draftType]` safely.
 */
export async function loadAutonomyPreferences(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  byDraftType: Record<string, {
    autoSendEnabled: boolean;
    enabledAt: string | null;
    offeredAt: string | null;
    offerDismissedCount: number;
  }>;
  globalPaused: boolean;
}> {
  const { data } = await supabase
    .from('agent_autonomy_preferences')
    .select('draft_type, auto_send_enabled, enabled_at, offered_at, offer_dismissed_count')
    .eq('user_id', userId);

  const byDraftType: Record<string, any> = {};
  let globalPaused = false;

  for (const row of data || []) {
    if (row.draft_type === GLOBAL_PAUSE_DRAFT_TYPE) {
      globalPaused = !!row.auto_send_enabled;
      continue;
    }
    byDraftType[row.draft_type] = {
      autoSendEnabled: !!row.auto_send_enabled,
      enabledAt: row.enabled_at,
      offeredAt: row.offered_at,
      offerDismissedCount: row.offer_dismissed_count || 0,
    };
  }

  return { byDraftType, globalPaused };
}

/**
 * The trust-floor auto-revert: when >= 2 of the last 10 auto-sends on a
 * draft_type were undone, we flip the preference off and return true so the
 * caller can surface a soft notification.
 */
export async function enforceTrustFloor(
  supabase: SupabaseClient,
  userId: string,
  draftType: string,
): Promise<{ reverted: boolean }> {
  if (isStatutoryDraftType(draftType)) return { reverted: false };

  const { data: recent } = await supabase
    .from('agent_send_history')
    .select('undone, send_mode, sent_at')
    .eq('user_id', userId)
    .eq('draft_type', draftType)
    .eq('send_mode', 'auto_sent')
    .order('sent_at', { ascending: false })
    .limit(ELIGIBILITY_RULES.trustFloorWindow);

  const undone = (recent || []).filter((r) => r.undone).length;
  if (undone < ELIGIBILITY_RULES.trustFloorUndoneThreshold) {
    return { reverted: false };
  }

  await supabase
    .from('agent_autonomy_preferences')
    .upsert(
      {
        user_id: userId,
        draft_type: draftType,
        auto_send_enabled: false,
        disabled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,draft_type' },
    );

  return { reverted: true };
}

/**
 * Per-draft-type required-field lists mirror the tool schemas in
 * lib/agent-intelligence/voice-actions.ts. We can't import the const there
 * without pulling in a bunch of unrelated schema data, so we keep the
 * authoritative list here and it's trivially audit-able.
 */
export const REQUIRED_FIELDS_BY_DRAFT_TYPE: Record<string, readonly string[]> = {
  vendor_update: ['vendor_id', 'update_summary', 'tone', 'send_method'],
  draft_vendor_update: ['vendor_id', 'update_summary', 'tone', 'send_method'],
};
