/**
 * Session 5A regression guards for the post-viewing voice capture
 * extraction step. Each test pins a sample transcript against the
 * expected extraction shape so regressions in `extractPostViewingActions`
 * surface immediately.
 *
 * Hermetic — stubbed OpenAI client, no network. The stub mirrors the
 * `openai` SDK's `chat.completions.create` so the function-under-test
 * can run unchanged. We assert on the post-normalisation shape (the
 * thing the orchestrator actually consumes).
 */

import {
  extractPostViewingActions,
  scrubFollowUpBody,
  type PostViewingExtraction,
  type PostViewingContext,
} from '../../lib/agent-intelligence/tools/voice-capture-tools';

function stubOpenAI(jsonByPrompt: (userPrompt: string) => any) {
  return {
    chat: {
      completions: {
        async create(args: any) {
          const userPrompt =
            args.messages.find((m: any) => m.role === 'user')?.content ?? '';
          const payload = jsonByPrompt(userPrompt);
          return {
            choices: [
              {
                message: { content: JSON.stringify(payload) },
              },
            ],
          };
        },
      },
    },
  } as any;
}

const NIAMH_CTX: PostViewingContext = {
  viewing_id: 'view-1',
  applicant_id: 'appl-1',
  applicant_name: "Niamh O'Brien",
  development_name: 'Lakeside Manor',
  scheduled_at: '2026-05-13T16:00:00Z',
};

describe('extractPostViewingActions', () => {
  it('shapes a high-interest transcript with concerns + next steps', async () => {
    const client = stubOpenAI(() => ({
      outcome: 'high_interest',
      structured_notes: [
        { category: 'concern', content: 'Worried about heating bills' },
        { category: 'question', content: 'Asked about upstairs bedroom dimensions' },
        { category: 'next_step', content: 'Follow up Friday morning' },
      ],
      next_actions: [
        {
          type: 'follow_up_email',
          timing: 'Friday morning',
          details: 'Send dimensions and BER info',
        },
      ],
      suggested_follow_up: {
        tone: 'warm',
        subject: 'Following up on your viewing at Lakeside Manor',
        body: "Hi Niamh,\n\nGreat to see you yesterday. I'll get those upstairs dimensions over to you Friday morning.\n\nCheers,\nSarah",
        addresses_concerns: ['Worried about heating bills', 'Asked about upstairs bedroom dimensions'],
      },
      confidence: 'high',
    }));

    const out = await extractPostViewingActions(
      "Viewing with Niamh went really well. She loved the space but is a bit worried about the heating bills. Wants to see the upstairs bedroom dimensions. Follow up Friday morning.",
      NIAMH_CTX,
      { client, agentDisplayName: 'Sarah O Reilly' },
    );

    expect(out.outcome).toBe('high_interest');
    expect(out.structured_notes).toHaveLength(3);
    expect(out.next_actions[0].timing).toBe('Friday morning');
    expect(out.suggested_follow_up).not.toBeNull();
    expect(out.suggested_follow_up!.body).toContain('Niamh');
    expect(out.suggested_follow_up!.body).not.toMatch(/—/);
    expect(out.confidence).toBe('high');
  });

  it('shapes a mild-interest transcript', async () => {
    const client = stubOpenAI(() => ({
      outcome: 'mild_interest',
      structured_notes: [
        { category: 'general', content: 'Said the kitchen felt a bit dated' },
      ],
      next_actions: [],
      suggested_follow_up: {
        tone: 'neutral',
        subject: 'Following up on Lakeside Manor',
        body: 'Hi Niamh,\n\nThanks for coming over today. Let me know if anything else comes to mind.\n\nCheers,\nSarah',
        addresses_concerns: [],
      },
      confidence: 'medium',
    }));

    const out = await extractPostViewingActions(
      'She was polite, said the kitchen felt a bit dated, but otherwise nothing strong.',
      NIAMH_CTX,
      { client },
    );

    expect(out.outcome).toBe('mild_interest');
    expect(out.suggested_follow_up).not.toBeNull();
    expect(out.confidence).toBe('medium');
  });

  it('suppresses the follow-up draft for no_interest outcomes', async () => {
    const client = stubOpenAI(() => ({
      outcome: 'no_interest',
      structured_notes: [
        { category: 'general', content: 'Said the location was wrong for them' },
      ],
      next_actions: [],
      suggested_follow_up: {
        tone: 'firm',
        subject: 'Some properties to keep an eye on',
        body: 'Hi Niamh,\n\nLets keep in touch when something better fits.\n\nCheers,\nSarah',
        addresses_concerns: [],
      },
      confidence: 'high',
    }));

    const out = await extractPostViewingActions(
      "She said it's not for her, the location is wrong.",
      NIAMH_CTX,
      { client },
    );

    expect(out.outcome).toBe('no_interest');
    expect(out.suggested_follow_up).toBeNull();
  });

  it('shapes a callback_needed transcript', async () => {
    const client = stubOpenAI(() => ({
      outcome: 'callback_needed',
      structured_notes: [
        { category: 'concern', content: 'Needs her partner to see it before deciding' },
      ],
      next_actions: [
        {
          type: 'schedule_callback',
          timing: null,
          details: 'Find out when her partner is free',
        },
      ],
      suggested_follow_up: {
        tone: 'warm',
        subject: 'Lakeside Manor — second viewing for your partner',
        body: 'Hi Niamh,\n\nLet me know what times suit you and your partner for a second look.\n\nCheers,\nSarah',
        addresses_concerns: ['Needs her partner to see it before deciding'],
      },
      confidence: 'high',
    }));

    const out = await extractPostViewingActions(
      'She likes it but wants her partner to see it before deciding.',
      NIAMH_CTX,
      { client },
    );

    expect(out.outcome).toBe('callback_needed');
    expect(out.next_actions[0].timing).toBeNull();
    expect(out.suggested_follow_up).not.toBeNull();
  });

  it('marks confidence=low when the transcript is under 8 words', async () => {
    const client = stubOpenAI(() => ({
      outcome: 'mild_interest',
      structured_notes: [],
      next_actions: [],
      suggested_follow_up: null,
      confidence: 'high', // model says high — normaliser should downgrade
    }));

    const out = await extractPostViewingActions('Went grand.', NIAMH_CTX, { client });

    expect(out.confidence).toBe('low');
  });

  it('returns an empty extraction with confidence=low when transcript is blank', async () => {
    const out = await extractPostViewingActions(
      '   ',
      NIAMH_CTX,
      {
        client: stubOpenAI(() => ({
          outcome: 'mild_interest',
          structured_notes: [],
          next_actions: [],
          suggested_follow_up: null,
          confidence: 'high',
        })),
      },
    );

    // No LLM call should have shaped this; the helper short-circuits.
    expect(out.confidence).toBe('low');
    expect(out.structured_notes).toHaveLength(0);
  });

  it('drops notes with empty content and actions with empty details', async () => {
    const client = stubOpenAI(() => ({
      outcome: 'mild_interest',
      structured_notes: [
        { category: 'concern', content: '' },
        { category: 'general', content: 'Said the garden was small' },
      ],
      next_actions: [
        { type: 'follow_up_email', timing: null, details: '' },
        { type: 'send_information', timing: null, details: 'Send floorplan' },
      ],
      suggested_follow_up: null,
      confidence: 'medium',
    }));

    const out = await extractPostViewingActions(
      "She mentioned the garden was small, asked me to send the floor plan.",
      NIAMH_CTX,
      { client },
    );

    expect(out.structured_notes).toHaveLength(1);
    expect(out.next_actions).toHaveLength(1);
    expect(out.next_actions[0].details).toBe('Send floorplan');
  });

  it('falls back to safe defaults when the model returns garbage', async () => {
    const client = {
      chat: {
        completions: {
          async create() {
            return {
              choices: [{ message: { content: 'not-json' } }],
            };
          },
        },
      },
    } as any;

    const out = await extractPostViewingActions(
      "She really liked the kitchen, follow up next Tuesday after she speaks to her partner.",
      NIAMH_CTX,
      { client },
    );

    expect(out.outcome).toBe('mild_interest');
    expect(out.structured_notes).toHaveLength(0);
    expect(out.next_actions).toHaveLength(0);
    expect(out.suggested_follow_up).toBeNull();
    expect(out.confidence).toBe('medium');
  });
});

describe('scrubFollowUpBody', () => {
  it('strips em dashes and replaces with comma-space', () => {
    const out = scrubFollowUpBody("Hi Niamh, just following up — let me know your thoughts.\n\nCheers,\nSarah");
    expect(out).not.toMatch(/—/);
    expect(out).toContain('just following up,');
  });

  it('drops a leading "I hope this finds you well" line', () => {
    const out = scrubFollowUpBody(
      "Hi Niamh,\n\nI hope this finds you well.\n\nGreat to see you yesterday.\n\nCheers,\nSarah",
    );
    expect(out.toLowerCase()).not.toContain('hope this finds you well');
    expect(out).toContain('Great to see you yesterday');
  });

  it('returns an empty string when the body is null/undefined/blank', () => {
    expect(scrubFollowUpBody('')).toBe('');
    expect(scrubFollowUpBody(undefined as any)).toBe('');
    expect(scrubFollowUpBody(null as any)).toBe('');
  });
});

// Type-only assertion: shape compatibility with the orchestrator's input.
const _shapeCheck: PostViewingExtraction = {
  outcome: 'mild_interest',
  structured_notes: [],
  next_actions: [],
  suggested_follow_up: null,
  confidence: 'medium',
};
void _shapeCheck;
