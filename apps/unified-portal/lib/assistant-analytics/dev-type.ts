/**
 * Coarse development_type bucket for analytics.
 *
 * Takes a developmentId so the mapping can be done here without the caller ever
 * storing the id itself (the id is NOT persisted — only the derived bucket is).
 *
 * Placeholder: returns 'unknown' for every input.
 *
 * TODO: Map developmentId to a coarse, non-identifying bucket (e.g.
 * 'houses-snagging-phase', 'apartments-occupied', 'mixed-handover') once we
 * decide the bucket taxonomy. The buckets must stay coarse enough that they
 * cannot single out one development.
 */
export function deriveDevelopmentType(_developmentId: string | null): string {
  return 'unknown';
}
