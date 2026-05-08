/**
 * Server-side two-step chain regression guards.
 *
 * Background: PR #97's live test showed the model treated the soft
 * "Next: …" envelope nudge as text to display rather than instruction
 * to execute. This module locks down the deterministic chain helpers
 * the chat route uses to fire draft_buyer_followups in the same turn
 * as get_candidate_units.
 *
 * Hermetic — pure functions, no Supabase / no network.
 */

import {
  messageHasDraftIntent,
  planChainFromIntent,
  buildChainTargets,
  shouldChainAfterCandidateUnits,
} from '../../lib/agent-intelligence/chain-orchestration';
import type { UnitCandidate } from '../../lib/agent-intelligence/unit-resolver';

describe('messageHasDraftIntent', () => {
  it.each([
    'Show me the buyers at lakeside manor whose mortgage is expiring in the next 30 days and draft chase emails for all of them',
    'Send chase emails to buyers who haven\'t signed contracts yet',
    'Find anyone whose mortgage is expiring AND email them',
    'List the unsigned contracts and chase them',
    'Reach out to anyone who hasn\'t signed',
    'Follow up with the overdue buyers',
    'follow-up with everyone in the cohort',
    'mail the unsigned cohort',
    'ping the buyers about their mortgage',
    'message everyone whose deposit is in',
    'write to the unsigned buyers',
    'let me know who hasn\'t signed and contact them',
  ])('matches "%s"', (msg) => {
    expect(messageHasDraftIntent(msg)).toBe(true);
  });

  it.each([
    'show me overdue contracts',
    'list the unsigned contracts',
    'who hasn\'t signed yet',
    'how many buyers are in the pipeline',
    'tell me about Lakeside Manor',
    'what\'s the status of unit 12',
  ])('does NOT match read-only "%s"', (msg) => {
    expect(messageHasDraftIntent(msg)).toBe(false);
  });

  it('handles null and empty input', () => {
    expect(messageHasDraftIntent(null)).toBe(false);
    expect(messageHasDraftIntent(undefined)).toBe(false);
    expect(messageHasDraftIntent('')).toBe(false);
  });
});

describe('planChainFromIntent', () => {
  it('mortgage_expiring → chase + sentence-form topic mentioning mortgage', () => {
    const plan = planChainFromIntent('mortgage_expiring');
    expect(plan).not.toBeNull();
    expect(plan!.purpose).toBe('chase');
    expect(plan!.topic).toMatch(/mortgage/i);
    // Must read as a complete sentence (registry contract — Issue C of #96).
    expect(plan!.topic.trim()).toMatch(/[.!?]$/);
  });

  it('overdue_contracts → chase + sentence about contract signing', () => {
    const plan = planChainFromIntent('overdue_contracts');
    expect(plan).not.toBeNull();
    expect(plan!.purpose).toBe('chase');
    expect(plan!.topic).toMatch(/contract/i);
    expect(plan!.topic.trim()).toMatch(/[.!?]$/);
  });

  it('sale_agreed → chase + sentence about next steps', () => {
    const plan = planChainFromIntent('sale_agreed');
    expect(plan).not.toBeNull();
    expect(plan!.purpose).toBe('chase');
    expect(plan!.topic.trim()).toMatch(/[.!?]$/);
  });

  it('handover → congratulate_handover (topic ignored by template)', () => {
    const plan = planChainFromIntent('handover');
    expect(plan).not.toBeNull();
    expect(plan!.purpose).toBe('congratulate_handover');
  });

  it('all → null (too generic to auto-chain)', () => {
    expect(planChainFromIntent('all')).toBeNull();
  });
});

describe('buildChainTargets', () => {
  it('one target per candidate, scheme + unit number passed through', () => {
    const candidates: UnitCandidate[] = [
      { id: 'u-1', development_id: 'dev-1', scheme_name: 'Lakeside Manor', unit_number: '12', purchaser_name: 'Aoife Byrne', status_hint: 'mortgage approval expires 2026-05-10 (3d)' },
      { id: 'u-2', development_id: 'dev-1', scheme_name: 'Lakeside Manor', unit_number: '15', purchaser_name: 'Rónán McCarthy', status_hint: 'mortgage approval expires 2026-05-25 (18d)' },
    ];
    expect(buildChainTargets(candidates)).toEqual([
      { unit_identifier: '12', scheme_name: 'Lakeside Manor' },
      { unit_identifier: '15', scheme_name: 'Lakeside Manor' },
    ]);
  });

  it('empty candidate list → empty targets', () => {
    expect(buildChainTargets([])).toEqual([]);
  });
});

describe('shouldChainAfterCandidateUnits — full gate', () => {
  const cohort: UnitCandidate[] = [
    { id: 'u-1', development_id: 'dev-1', scheme_name: 'Lakeside Manor', unit_number: '12', purchaser_name: 'Aoife', status_hint: 'mortgage approval expires 2026-05-10 (3d)' },
  ];

  it('all conditions met → returns chain plan + targets', () => {
    const result = shouldChainAfterCandidateUnits({
      toolName: 'get_candidate_units',
      intent: 'mortgage_expiring',
      candidates: cohort,
      userMessage:
        'Show me the buyers at lakeside manor whose mortgage is expiring in the next 30 days and draft chase emails for all of them',
    });
    expect(result).not.toBeNull();
    expect(result!.plan.purpose).toBe('chase');
    expect(result!.plan.topic).toMatch(/mortgage/i);
    expect(result!.targets).toEqual([
      { unit_identifier: '12', scheme_name: 'Lakeside Manor' },
    ]);
  });

  it('wrong tool → no chain', () => {
    const result = shouldChainAfterCandidateUnits({
      toolName: 'get_buyer_details',
      intent: 'mortgage_expiring',
      candidates: cohort,
      userMessage: 'show me Aoife\'s details and email her',
    });
    expect(result).toBeNull();
  });

  it('zero candidates → no chain', () => {
    const result = shouldChainAfterCandidateUnits({
      toolName: 'get_candidate_units',
      intent: 'mortgage_expiring',
      candidates: [],
      userMessage: 'show me whose mortgage is expiring and email them',
    });
    expect(result).toBeNull();
  });

  it('null intent → no chain', () => {
    const result = shouldChainAfterCandidateUnits({
      toolName: 'get_candidate_units',
      intent: null,
      candidates: cohort,
      userMessage: 'show me the candidates and email them',
    });
    expect(result).toBeNull();
  });

  it('intent="all" → no chain (too generic)', () => {
    const result = shouldChainAfterCandidateUnits({
      toolName: 'get_candidate_units',
      intent: 'all',
      candidates: cohort,
      userMessage: 'show me everyone and email them',
    });
    expect(result).toBeNull();
  });

  it('user message has no draft intent → no chain (pure show-me)', () => {
    const result = shouldChainAfterCandidateUnits({
      toolName: 'get_candidate_units',
      intent: 'mortgage_expiring',
      candidates: cohort,
      userMessage: 'show me whose mortgage is expiring at lakeside manor',
    });
    expect(result).toBeNull();
  });

  // Worked example from the live-test failure that motivated this PR.
  it('production failure repro — Test 2 retry chains correctly', () => {
    const candidates: UnitCandidate[] = [
      { id: 'u-9', development_id: 'dev-1', scheme_name: 'Lakeside Manor', unit_number: '9', purchaser_name: 'Ailbhe Tierney', status_hint: 'mortgage approval expires 2026-05-10 (3d)' },
    ];
    const result = shouldChainAfterCandidateUnits({
      toolName: 'get_candidate_units',
      intent: 'mortgage_expiring',
      candidates,
      userMessage:
        'Show me the buyers at lakeside manor whose mortgage is expiring in the next 30 days and draft chase emails for all of them',
    });
    expect(result).not.toBeNull();
    expect(result!.targets).toEqual([
      { unit_identifier: '9', scheme_name: 'Lakeside Manor' },
    ]);
    expect(result!.plan.purpose).toBe('chase');
    // Topic must be a complete sentence in the agent's voice — not the
    // "[full sentence describing the reason]" placeholder hint.
    expect(result!.plan.topic).not.toMatch(/\[/);
    expect(result!.plan.topic.trim()).toMatch(/[.!?]$/);
  });
});
