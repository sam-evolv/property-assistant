// Housing Reasoning v0.1 types.
//
// These mirror the locked behavioural contract in
// docs/prompts/housing-reasoning-v1.md: the four actions and the issue-report
// fields. They define the JSON the model is constrained to return (see
// service.ts) and are mapped to the existing issue_reports shape at the route
// boundary, not here.

export type HousingUserType = 'homeowner' | 'site_team';

export type HousingReasoningAction =
  | 'ANSWER_ONLY'
  | 'CREATE_ISSUE_REPORT'
  | 'ESCALATE_IMMEDIATELY'
  | 'REFER_TO_WARRANTY';

export type IssueSeverity = 'minor' | 'moderate' | 'major';

export type IssueCategory =
  | 'cosmetic'
  | 'cleaning'
  | 'joinery'
  | 'plumbing'
  | 'electrical'
  | 'external'
  | 'landscape'
  | 'compliance'
  | 'appliance'
  | 'other';

export type IssueStatus = 'open' | 'closed';

export interface HousingIssueReport {
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

export interface HousingReasoningResult {
  action: HousingReasoningAction;
  /** Resident/site-team-facing reply text. For ANSWER_ONLY this is the answer. */
  message: string;
  /** Present when the action logs an issue; null for ANSWER_ONLY. */
  issue_report: HousingIssueReport | null;
  /**
   * Token usage for this call. Attached by the service after parsing the model
   * output; never produced by the model itself. Optional so callers (and the
   * smoke test's canned results) need not supply it.
   */
  usage?: TokenUsage;
}

export interface AnalyseMessageInput {
  userType: HousingUserType;
  text: string;
  /** Image inputs passed straight to OpenAI as image_url (signed URLs or data URLs). */
  images: string[];
}
