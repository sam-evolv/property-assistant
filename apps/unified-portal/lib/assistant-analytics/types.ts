/**
 * Types for anonymous per-turn assistant analytics.
 *
 * LogInput is what the route hands to logTurn() for one turn. AnalyticsRow is
 * the exact shape inserted into the assistant_analytics_anonymous table
 * (migration 064). The two differ deliberately:
 *
 *   - developmentId and userName are present on LogInput but NEVER stored.
 *     developmentId is used only to derive a coarse development_type bucket;
 *     userName is used only to redact the user's own name out of free text.
 *   - message/response free text is redacted before it becomes
 *     message_text_redacted / response_text_redacted.
 *   - id and occurred_on are omitted: the database fills them (gen_random_uuid
 *     and current_date defaults).
 */

/** One attached media item, as much as the route knows about it. */
export interface AttachedMediaItem {
  mime: string;
  size: number;
  width?: number;
  height?: number;
}

export interface LogInput {
  /** 'openhouse_agent_v1' | 'housing_reasoning_v1' | 'placeholder'. */
  flagPath: string;
  promptVersion?: string | null;
  /** Coarse role (homeowner / admin role / snag). Not an identifier. */
  userRole?: string | null;

  /** Raw user message text. Redacted before storage. */
  messageText?: string | null;
  /** Attached media (images). Count + dimensions only; no bytes/filenames. */
  attachedMedia?: AttachedMediaItem[] | null;
  /** Transcript of a voice note, if one was provided. Redacted before storage. */
  audioTranscript?: string | null;

  modelUsed?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  costUsdMicro?: number | null;
  latencyMs?: number | null;

  /** Assistant reply text. Redacted before storage. */
  responseText?: string | null;
  actionReturned?: string | null;
  issueCreated?: boolean;
  severityReturned?: string | null;
  categoryReturned?: string | null;

  /** Used ONLY to derive development_type. NOT stored. */
  developmentId?: string | null;
  /** Used ONLY to redact the user's own name from free text. NOT stored. */
  userName?: string | null;

  errored?: boolean;
  errorType?: string | null;
}

/** Exact column shape inserted into assistant_analytics_anonymous. */
export interface AnalyticsRow {
  flag_path: string;
  prompt_version: string | null;
  user_role: string | null;
  message_text_redacted: string | null;
  message_had_image: boolean;
  image_count: number;
  image_classification: string | null;
  message_had_audio: boolean;
  model_used: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  cost_usd_micro: number | null;
  latency_ms: number | null;
  response_text_redacted: string | null;
  action_returned: string | null;
  issue_created: boolean;
  severity_returned: string | null;
  category_returned: string | null;
  development_type: string;
  errored: boolean;
  error_type: string | null;
}

/**
 * Minimal structural type for the Supabase insert surface logTurn needs. Lets
 * the smoke test inject a mock that records the insert call without pulling in
 * the real service-role client (and its env/DB requirements).
 */
export interface AnalyticsInsertClient {
  from(table: string): {
    insert(row: AnalyticsRow): Promise<{ error: { message: string } | null }>;
  };
}
