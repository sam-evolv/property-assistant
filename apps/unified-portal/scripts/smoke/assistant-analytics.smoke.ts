/**
 * Assistant analytics — smoke test.
 *
 * Plain TypeScript, no test runner. Exercises redactPII() and logTurn() with a
 * MOCKED Supabase insert client (no network, no DB, no env). Covers PII
 * redaction (email / Irish phone / Eircode / user name) and that logTurn builds
 * and inserts a row of the expected shape — including the privacy guarantee
 * that no direct identifiers are written.
 *
 * Run:
 *   npx tsx apps/unified-portal/scripts/smoke/assistant-analytics.smoke.ts
 *
 * Exit 0 = all cases pass. Exit 1 = a case failed.
 */

import { redactPII } from '../../lib/assistant-analytics/redact';
import { logTurn } from '../../lib/assistant-analytics/logger';
import type {
  AnalyticsInsertClient,
  AnalyticsRow,
  LogInput,
} from '../../lib/assistant-analytics/types';

let failures = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// Mock insert client that records the table + row it was asked to insert, so we
// can assert against the captured call without touching a real database.
function mockClient(): { client: AnalyticsInsertClient; captured: { table?: string; row?: AnalyticsRow } } {
  const captured: { table?: string; row?: AnalyticsRow } = {};
  const client: AnalyticsInsertClient = {
    from(table: string) {
      captured.table = table;
      return {
        insert(row: AnalyticsRow) {
          captured.row = row;
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  return { client, captured };
}

async function run(): Promise<void> {
  // --- Case 1: redactPII strips an email ---
  {
    console.log('Case 1: redactPII strips an email');
    const out = redactPII('reach me at sam@evolvai.ie anytime');
    check('email removed', !out.includes('sam@evolvai.ie'), out);
    check('replaced with [redacted]', out.includes('[redacted]'), out);
  }

  // --- Case 2: redactPII strips Irish phones (+353 and 08x forms) ---
  {
    console.log('Case 2: redactPII strips Irish phone numbers');
    const intl = redactPII('call +353 87 1234567 now');
    check('+353 form removed', !intl.includes('1234567') && !intl.includes('+353'), intl);
    check('+353 replaced', intl.includes('[redacted]'), intl);

    const mobile = redactPII('or 087 1234567 instead');
    check('087 form removed', !mobile.includes('087 1234567') && !mobile.includes('1234567'), mobile);
    check('087 replaced', mobile.includes('[redacted]'), mobile);
  }

  // --- Case 3: redactPII strips an Eircode ---
  {
    console.log('Case 3: redactPII strips an Eircode');
    const out = redactPII('my Eircode is T12 ABCD thanks');
    check('Eircode removed', !out.includes('T12 ABCD'), out);
    check('Eircode replaced', out.includes('[redacted]'), out);
  }

  // --- Case 4: redactPII strips the user's name when provided ---
  {
    console.log("Case 4: redactPII strips the user's name when provided");
    const out = redactPII('Hi, this is Sam Donworth speaking', 'Sam Donworth');
    check('name removed', !out.includes('Sam Donworth'), out);
    check('name replaced', out.includes('[redacted]'), out);
    // Without the name arg, the name survives (proves it's the name arg doing it).
    const noName = redactPII('Hi, this is Sam Donworth speaking');
    check('name survives without the name arg', noName.includes('Sam Donworth'), noName);
  }

  // --- Case 4b: combined sentence (manual-verification case from the spec) ---
  {
    console.log('Case 4b: combined PII sentence is fully stripped');
    const out = redactPII(
      "Hi, I'm Sam Donworth, email sam@evolvai.ie, phone 087 1234567, Eircode T12 ABCD",
      'Sam Donworth',
    );
    check('no name', !out.includes('Sam Donworth'), out);
    check('no email', !out.includes('sam@evolvai.ie'), out);
    check('no phone', !out.includes('087 1234567') && !out.includes('1234567'), out);
    check('no eircode', !out.includes('T12 ABCD'), out);
  }

  // --- Case 5: logTurn inserts a row of the expected shape ---
  {
    console.log('Case 5: logTurn inserts a full row with the expected shape');
    const { client, captured } = mockClient();
    const input: LogInput = {
      flagPath: 'openhouse_agent_v1',
      promptVersion: 'openhouse-assistant-v1@test',
      userRole: 'homeowner',
      messageText: "I'm Sam Donworth, email sam@evolvai.ie, ring 087 1234567, Eircode T12 ABCD",
      attachedMedia: [{ mime: 'image/jpeg', size: 120000, width: 1024, height: 768 }],
      audioTranscript: null,
      modelUsed: 'gpt-4o',
      tokensIn: 1200,
      tokensOut: 340,
      costUsdMicro: 6400,
      latencyMs: 2200,
      responseText: 'That looks like an active leak; I will log it for the site team.',
      actionReturned: 'create_issue_report',
      issueCreated: true,
      severityReturned: 'high',
      categoryReturned: 'plumbing',
      developmentId: 'dev-abc-123', // must NOT be stored
      userName: 'Sam Donworth', // must NOT be stored; used only to redact
      errored: false,
      errorType: null,
    };
    await logTurn(input, { client });

    const row = captured.row;
    check('insert hit the analytics table', captured.table === 'assistant_analytics_anonymous', String(captured.table));
    check('row was inserted', !!row);
    if (row) {
      check('flag_path', row.flag_path === 'openhouse_agent_v1', row.flag_path);
      check('prompt_version', row.prompt_version === 'openhouse-assistant-v1@test', String(row.prompt_version));
      check('user_role', row.user_role === 'homeowner', String(row.user_role));
      check('message_had_image', row.message_had_image === true, String(row.message_had_image));
      check('image_count', row.image_count === 1, String(row.image_count));
      check('image_classification', row.image_classification === 'image', String(row.image_classification));
      check('message_had_audio', row.message_had_audio === false, String(row.message_had_audio));
      check('model_used', row.model_used === 'gpt-4o', String(row.model_used));
      check('tokens_input', row.tokens_input === 1200, String(row.tokens_input));
      check('tokens_output', row.tokens_output === 340, String(row.tokens_output));
      check('cost_usd_micro', row.cost_usd_micro === 6400, String(row.cost_usd_micro));
      check('latency_ms', row.latency_ms === 2200, String(row.latency_ms));
      check('action_returned', row.action_returned === 'create_issue_report', String(row.action_returned));
      check('issue_created', row.issue_created === true, String(row.issue_created));
      check('severity_returned', row.severity_returned === 'high', String(row.severity_returned));
      check('category_returned', row.category_returned === 'plumbing', String(row.category_returned));
      check('development_type defaults to unknown', row.development_type === 'unknown', String(row.development_type));
      check('errored', row.errored === false, String(row.errored));

      const redacted = row.message_text_redacted ?? '';
      check('message redacted: no name', !redacted.includes('Sam Donworth'), redacted);
      check('message redacted: no email', !redacted.includes('sam@evolvai.ie'), redacted);
      check('message redacted: no phone', !redacted.includes('1234567'), redacted);
      check('message redacted: no eircode', !redacted.includes('T12 ABCD'), redacted);

      // Privacy guarantee: no direct identifiers are present on the row.
      const forbidden = [
        'development_id',
        'developmentId',
        'user_id',
        'userId',
        'user_name',
        'userName',
        'conversation_id',
        'unit_id',
        'message_id',
      ];
      const leaked = forbidden.filter((k) => k in (row as Record<string, unknown>));
      check('no identifier columns on the row', leaked.length === 0, `leaked: ${leaked.join(', ')}`);
    }
  }

  // --- Case 6: logTurn with errored=true still inserts an errored row ---
  {
    console.log('Case 6: logTurn(errored=true) inserts an errored row');
    const { client, captured } = mockClient();
    const input: LogInput = {
      flagPath: 'housing_reasoning_v1',
      modelUsed: 'gpt-4o',
      messageText: null,
      errored: true,
      errorType: 'model_call_failed: boom',
    };
    await logTurn(input, { client });

    const row = captured.row;
    check('errored row inserted', !!row);
    if (row) {
      check('flag_path', row.flag_path === 'housing_reasoning_v1', row.flag_path);
      check('errored is true', row.errored === true, String(row.errored));
      check('error_type populated', row.error_type === 'model_call_failed: boom', String(row.error_type));
      check('no image on errored row', row.message_had_image === false, String(row.message_had_image));
      check('message_text_redacted null when no message', row.message_text_redacted === null, String(row.message_text_redacted));
    }
  }

  console.log('');
  if (failures > 0) {
    console.log(`SMOKE FAILED — ${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log('SMOKE PASSED — all cases green.');
  process.exit(0);
}

run().catch((err) => {
  console.error('SMOKE ERRORED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
