/**
 * Regression guard for Issue 1.1 / Chrome ISSUE-001.
 *
 * The "Next:" hint inside `getCandidateUnitsSkill`'s envelope summary
 * was reaching the user verbatim as a red error block. Redacting it on
 * the way out — but keeping it in the model's tool-result context for
 * chain orchestration — is the contract under test.
 */

import { redactSummaryForUser, redactEnvelopeForUser } from '../../lib/agent-intelligence/redact-scaffolding';

describe('redactSummaryForUser (Issue 1.1)', () => {
  it('strips the PR-97 "Next:" scaffolding line verbatim', () => {
    const input = [
      'Found 3 candidate units (mortgage_expiring):',
      '- Lakeside Manor Unit 12 — Aoife Carey (sale agreed)',
      '- Lakeside Manor Unit 14 — Lucy Reid (signed)',
      '- Lakeside Manor Unit 19 — Cian Murphy (sale agreed)',
      '',
      "Next: if the user asked for drafts, immediately call draft_buyer_followups(targets=[the units above], purpose='chase', topic='[full sentence describing the reason]') in the SAME turn. Do not stop after this candidate list — it is the input to step 2, not the final answer.",
    ].join('\n');
    const out = redactSummaryForUser(input);
    expect(out).toContain('Found 3 candidate units');
    expect(out).toContain('Lakeside Manor Unit 12');
    expect(out).not.toContain('Next:');
    expect(out).not.toContain('draft_buyer_followups');
    expect(out).not.toContain('targets=');
    expect(out).not.toContain('full sentence describing');
    expect(out).not.toContain('SAME turn');
    expect(out).not.toContain('input to step 2');
    expect(out).not.toContain('the final answer');
  });

  it('preserves a legitimate skill summary verbatim', () => {
    const input = [
      'Drafted 3 follow-ups for buyers at Lakeside Manor.',
      '- Lucy Reid — Unit 14',
      '- Cian Murphy — Unit 19',
      '- Aoife Carey — Unit 12',
    ].join('\n');
    expect(redactSummaryForUser(input)).toBe(input);
  });

  it('strips a "Step 2:" variant carrying the same scaffolding', () => {
    const input =
      'Step 2: call draft_buyer_followups(targets=[...], purpose=\'chase\') in the SAME turn.';
    expect(redactSummaryForUser(input)).toBe('');
  });

  it('strips a placeholder marker even without a Next: prefix', () => {
    const input = 'Compose body using [full sentence describing the reason] then send.';
    expect(redactSummaryForUser(input)).toBe('');
  });

  it('handles null / undefined / empty', () => {
    expect(redactSummaryForUser(null)).toBe('');
    expect(redactSummaryForUser(undefined)).toBe('');
    expect(redactSummaryForUser('')).toBe('');
  });

  it('collapses double-blank lines left behind after redaction', () => {
    const input = [
      'Found 1 candidate unit (handover):',
      '- Westfield Heights Unit 25 — Mark Sweeney',
      '',
      '',
      "Next: call draft_buyer_followups(targets=[...], purpose='congratulate_handover', topic='[full sentence describing]') in the SAME turn.",
    ].join('\n');
    const out = redactSummaryForUser(input);
    expect(out).not.toMatch(/\n{3,}/);
    expect(out.endsWith('\n')).toBe(false);
  });

  it('does not strip a sentence that mentions a tool name in prose', () => {
    // "I'll need a recipient address" is legitimate user-facing copy that
    // happens to contain words like "recipient" — it doesn't carry the
    // tool-call argument syntax, so it must pass through.
    const input = "I need a recipient address for 'Aoife O'Brien'. Paste the address and I'll draft it.";
    expect(redactSummaryForUser(input)).toBe(input);
  });
});

describe('redactEnvelopeForUser (Issue 1.1)', () => {
  it('redacts the envelope summary AND each draft.reasoning', () => {
    const env = {
      skill: 'get_candidate_units',
      status: 'awaiting_approval',
      summary: 'Found 1 candidate.\n\nNext: call draft_buyer_followups(targets=[...]) in the SAME turn.',
      drafts: [
        {
          id: 'draft-1',
          // Multi-line reasoning where one line is scaffolding and the
          // others are legit data — the legit lines must survive.
          reasoning: 'Lease ends 12 May 2026.\nNext: call draft_lease_renewal(tenancy_id=...) in the SAME turn.\nProperty in RPZ.',
        },
      ],
    };
    const out = redactEnvelopeForUser(env);
    expect(out.summary).toBe('Found 1 candidate.');
    expect(out.drafts[0].reasoning).toBe('Lease ends 12 May 2026.\nProperty in RPZ.');
    // Original is not mutated.
    expect(env.summary).toContain('Next:');
    expect(env.drafts[0].reasoning).toContain('Next:');
  });
});
