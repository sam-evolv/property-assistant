/**
 * Anonymous per-turn analytics logger for the multimodal assistant route.
 *
 * ── What this is ──────────────────────────────────────────────────────────
 * One row per assistant turn (all three flag paths: openhouse agent,
 * housing-reasoning-v1, placeholder), written to assistant_analytics_anonymous
 * (migration 064). Used for service-quality and cost monitoring.
 *
 * ── Legal basis ───────────────────────────────────────────────────────────
 * GDPR Article 6(1)(f) — legitimate interest: improving the assistant and
 * monitoring model cost/latency. The balancing test is satisfied because the
 * data stored is anonymous (see below) and the processing is disclosed.
 *
 * Authorised by the live privacy policy section titled
 *   "OpenHouse Assistant Conversations".
 * That section must remain published for this logging to stay lawful. If the
 * disclosure is removed, disable the logging (it is a fire-and-forget call at
 * the route boundary and can be commented out, or roll back the table).
 *
 * ── What is and is NOT stored ─────────────────────────────────────────────
 * NO direct identifiers are stored: no user_id, conversation_id, unit_id,
 * development_id, message_id, IP, or device info. No image bytes, hashes, or
 * filenames. Free-text message/response are PII-redacted (best-effort, see
 * redact.ts) before insert. developmentId and userName reach this function but
 * are used only to DERIVE non-identifying fields (development_type) and to
 * REDACT (the user's own name) — they are never written to a column.
 *
 * ── Failure policy ────────────────────────────────────────────────────────
 * Best-effort. logTurn catches everything, logs "[analytics] log_failed:
 * <reason>" to the console, and never throws. A logging failure must never
 * break or delay a user's chat — the route fires this without awaiting (via
 * waitUntil) so it cannot add latency either.
 *
 * ── Rollback ──────────────────────────────────────────────────────────────
 * Drop the table: `drop table assistant_analytics_anonymous;`. No other code
 * path reads it, so the only impact is loss of analytics. Inserts will then
 * start failing, but logTurn swallows the error, so the user's chat is
 * unaffected.
 */

import { redactPII } from './redact';
import { classifyImage } from './classify-image';
import { deriveDevelopmentType } from './dev-type';
import type { AnalyticsInsertClient, AnalyticsRow, AttachedMediaItem, LogInput } from './types';

const ANALYTICS_TABLE = 'assistant_analytics_anonymous';

export interface LogTurnOptions {
  /**
   * Insert client. Defaults to the service-role Supabase client. Injected by
   * the smoke test so it can assert the captured insert without touching the
   * real DB. Resolved lazily (only when no client is passed) so importing this
   * module never pulls in the service-role client's env/DB requirements.
   */
  client?: AnalyticsInsertClient;
}

function imageItems(media: AttachedMediaItem[] | null | undefined): AttachedMediaItem[] {
  if (!media || media.length === 0) return [];
  // This route's attachments are images; guard anyway so a future audio/other
  // attachment cannot be miscounted as an image.
  return media.filter((m) => typeof m.mime === 'string' && m.mime.startsWith('image/'));
}

function buildRow(input: LogInput): AnalyticsRow {
  const images = imageItems(input.attachedMedia);
  const classifications = Array.from(new Set(images.map((m) => classifyImage(m))));
  const hasAudioAttachment = (input.attachedMedia ?? []).some(
    (m) => typeof m.mime === 'string' && m.mime.startsWith('audio/'),
  );

  return {
    flag_path: input.flagPath,
    prompt_version: input.promptVersion ?? null,
    user_role: input.userRole ?? null,
    message_text_redacted: input.messageText ? redactPII(input.messageText, input.userName) : null,
    message_had_image: images.length > 0,
    image_count: images.length,
    image_classification: classifications.length > 0 ? classifications.join(',') : null,
    message_had_audio: !!input.audioTranscript || hasAudioAttachment,
    model_used: input.modelUsed ?? null,
    tokens_input: input.tokensIn ?? null,
    tokens_output: input.tokensOut ?? null,
    cost_usd_micro: input.costUsdMicro ?? null,
    latency_ms: input.latencyMs ?? null,
    response_text_redacted: input.responseText ? redactPII(input.responseText, input.userName) : null,
    action_returned: input.actionReturned ?? null,
    issue_created: !!input.issueCreated,
    severity_returned: input.severityReturned ?? null,
    category_returned: input.categoryReturned ?? null,
    development_type: deriveDevelopmentType(input.developmentId ?? null),
    errored: !!input.errored,
    error_type: input.errorType ?? null,
  };
}

/**
 * Write one anonymous analytics row. Never throws. Safe to fire-and-forget.
 */
export async function logTurn(input: LogInput, options: LogTurnOptions = {}): Promise<void> {
  try {
    const row = buildRow(input);

    let client = options.client;
    if (!client) {
      // Lazy, relative import: keeps this module free of a top-level dependency
      // on the service-role client so the smoke test (which injects a client)
      // never loads it.
      const mod = await import('../supabase-server');
      client = mod.getSupabaseAdmin() as unknown as AnalyticsInsertClient;
    }

    const { error } = await client.from(ANALYTICS_TABLE).insert(row);
    if (error) {
      console.error(`[analytics] log_failed: ${error.message}`);
    }
  } catch (err) {
    console.error(`[analytics] log_failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
