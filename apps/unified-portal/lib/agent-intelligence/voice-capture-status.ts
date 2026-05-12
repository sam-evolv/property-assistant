/**
 * "Has this viewing already been voice-captured?" helper.
 *
 * The orchestrator (executePostViewingCapture) writes a row to
 * `pending_drafts` for the follow-up email with:
 *   - skill='post_viewing_voice_capture' (in content_json)
 *   - affected_record.kind='viewing', affected_record.id=<viewing_id>
 *     (in content_json)
 *
 * Detecting capture by joining on that marker keeps us out of the
 * viewing_audit_log table's CHECK constraint (the existing constraint
 * doesn't allow a 'captured' action value). It catches every capture
 * that produced a follow-up draft, which is every outcome except
 * 'no_interest' / 'viewing_didnt_happen'. For those two the orchestrator
 * already moves the viewing to completed/no_show, so the row no longer
 * surfaces the mic button anyway.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const VOICE_CAPTURE_SKILL = 'post_viewing_voice_capture';

export async function hasCaptureForViewing(
  supabase: SupabaseClient,
  viewingId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('pending_drafts')
    .select('id')
    .eq('content_json->>skill', VOICE_CAPTURE_SKILL)
    .eq('content_json->affected_record->>id', viewingId)
    .limit(1);
  if (error || !data) return false;
  return data.length > 0;
}

/**
 * Batched variant for list views that need to annotate many viewings at once.
 * Returns a Set of viewing_ids that have at least one capture marker.
 */
export async function viewingIdsWithCapture(
  supabase: SupabaseClient,
  viewingIds: string[],
): Promise<Set<string>> {
  const out = new Set<string>();
  if (viewingIds.length === 0) return out;
  const { data, error } = await supabase
    .from('pending_drafts')
    .select('content_json')
    .eq('content_json->>skill', VOICE_CAPTURE_SKILL);
  if (error || !data) return out;
  const requested = new Set(viewingIds);
  for (const row of data as Array<{ content_json: any }>) {
    const id = row?.content_json?.affected_record?.id;
    if (typeof id === 'string' && requested.has(id)) {
      out.add(id);
    }
  }
  return out;
}
