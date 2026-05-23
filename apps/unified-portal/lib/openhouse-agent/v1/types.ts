// OpenHouse Assistant v1 types.
//
// Source of truth for the behavioural contract:
//   docs/prompts/openhouse-assistant-v1.md
//
// The OpenHouse Assistant is a general home agent (cooking, cleaning, DIY,
// gardening, appliances, layout, ...). Its response is conversational `message`
// text plus an OPTIONAL structured issue_report, populated only when something
// genuinely belongs with the site team. When issue_report is null/absent this
// was a plain chat turn and nothing is persisted (see the route handler).
//
// The issue_report subtype deliberately REUSES the existing severity and
// category enums from housing-reasoning-v1 (and IssueStatus alongside) so the
// route's boundary mapping into issue_reports is identical for both paths. We
// import rather than redeclare so the two stay locked together; this file does
// not modify the housing-reasoning module.

import type {
  IssueSeverity,
  IssueCategory,
  IssueStatus,
} from '../../housing-reasoning/v1/types';

export type { IssueSeverity, IssueCategory, IssueStatus };

export type OpenhouseAgentUserType = 'homeowner' | 'site_team';

export interface OpenhouseAgentIssueReport {
  title: string;
  area: string | null;
  severity: IssueSeverity;
  category: IssueCategory;
  description: string;
  status: IssueStatus;
}

/**
 * OpenAI token usage for one call. Surfaced by the service so the route can log
 * cost/usage analytics. Not part of the model's JSON output — the service
 * attaches it from response.usage after parsing. Fields are null when the
 * provider does not report usage (e.g. the mocked client in the smoke test).
 */
export interface TokenUsage {
  input_tokens: number | null;
  output_tokens: number | null;
}

export interface OpenhouseAgentResult {
  /** Conversational, homeowner-facing reply. Always present. */
  message: string;
  /**
   * Present and non-null only when the agent decides something should be
   * logged for the site team. Null for an ordinary chat turn.
   */
  issue_report?: OpenhouseAgentIssueReport | null;
  /**
   * Token usage for this call. Attached by the service after parsing the
   * model output; never produced by the model itself. Optional so callers
   * (and the smoke test's canned results) need not supply it.
   */
  usage?: TokenUsage;
}

/**
 * What the agent knows about this specific home. Every field is optional: the
 * route passes only what it already loads (currently just the development and
 * unit ids — see step-8 FLAG in the route handler), and the richer fields
 * (room dimensions, floor plan, appliance models, snag history) are present
 * here so the service can thread them through once the data plumbing exists.
 * The smoke test exercises the richer fields against a mocked client.
 */
export interface OpenhouseAgentHouseContext {
  developmentId?: string | null;
  developmentName?: string | null;
  unitId?: string | null;
  unitName?: string | null;
  rooms?: Array<{ name: string; dimensions?: string | null }>;
  floorPlanRefs?: string[];
  applianceModels?: Array<{ name: string; model: string }>;
  snagHistory?: Array<{ title: string; area?: string | null; status?: string | null }>;
  [key: string]: unknown;
}

export interface CallAgentInput {
  userType: OpenhouseAgentUserType;
  text: string;
  /** Image inputs passed straight to OpenAI as image_url (signed URLs or data URLs). */
  images: string[];
  /**
   * Transcript of a voice note, when the caller recorded one. The prompt is
   * told it "reads transcripts of voice notes": transcription happens UPSTREAM
   * (at the route boundary) via lib/agent-intelligence/transcription.ts — the
   * existing OpenHouse Agent Deepgram->Whisper helper — so no audio bytes reach
   * this pure module and no new dependency is introduced.
   */
  audio?: string | null;
  /** What the route knows about this specific home. Optional. */
  houseContext?: OpenhouseAgentHouseContext | null;
}
