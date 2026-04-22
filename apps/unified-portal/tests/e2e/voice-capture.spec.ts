/**
 * Playwright smoke test for the voice capture + confirmation card flow.
 *
 * Install & run once:
 *   npm i -D @playwright/test
 *   npx playwright install chromium
 *   npx playwright test tests/e2e/voice-capture.spec.ts
 *
 * The test mocks transcription, extraction and execution endpoints so it
 * doesn't hit Deepgram / Claude / Supabase. The goal is a structural smoke
 * check: mic tap -> transcript arrives -> confirmation card renders ->
 * approve succeeds -> done state + undo pill visible.
 */
import { expect, test } from '@playwright/test';

const INTELLIGENCE_URL = '/agent/intelligence';

const MOCK_TRANSCRIPT =
  "Murphys came to 14 Oakfield, loved it, husband worried about the garden, offering Monday, tell the vendor";

const MOCK_ACTIONS = [
  {
    id: 'act_1',
    type: 'log_viewing',
    fields: {
      property_id: '14 Oakfield',
      attendees: [{ name: 'Murphys' }],
      viewing_date: new Date().toISOString(),
      interest_level: 'high',
      objections: 'Husband worried about the garden',
      feedback: 'Loved it overall',
      next_action: 'Follow up Monday',
    },
    confidence: {
      property_id: 0.9,
      attendees: 0.8,
      viewing_date: 0.6,
      interest_level: 0.85,
      objections: 0.9,
      feedback: 0.9,
      next_action: 0.7,
    },
  },
  {
    id: 'act_2',
    type: 'draft_vendor_update',
    fields: {
      vendor_id: '14 Oakfield',
      update_summary: 'Murphys viewed and loved the place, concern about the garden, may offer Monday.',
      tone: 'casual',
      send_method: 'email',
    },
    confidence: {
      vendor_id: 0.85,
      update_summary: 0.75,
      tone: 0.8,
      send_method: 0.7,
    },
  },
  {
    id: 'act_3',
    type: 'create_reminder',
    fields: {
      reminder_text: 'Chase Murphys on their offer for 14 Oakfield',
      due_date: nextMondayIso(),
      related_entity_type: 'viewing',
    },
    confidence: {
      reminder_text: 0.85,
      due_date: 0.65,
      related_entity_type: 0.6,
    },
  },
];

test.describe('Agent Intelligence voice capture', () => {
  test('mic tap renders card, approve shows done + undo pill', async ({ page, context }) => {
    await context.grantPermissions(['microphone']);

    await page.route('**/api/agent/intelligence/transcribe', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ transcript: MOCK_TRANSCRIPT, provider: 'mock' }),
      });
    });

    await page.route('**/api/agent/intelligence/extract-actions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ actions: MOCK_ACTIONS, transcript: MOCK_TRANSCRIPT }),
      });
    });

    await page.route('**/api/agent/intelligence/execute-actions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          batchId: 'batch_smoke',
          results: MOCK_ACTIONS.map((a) => ({
            id: a.id,
            type: a.type,
            success: true,
            targetId: `${a.id}_row`,
            message: `Executed ${a.type}`,
          })),
        }),
      });
    });

    // Patch getUserMedia + MediaRecorder so the hook can progress without a real mic.
    await page.addInitScript(() => {
      (navigator.mediaDevices as any).getUserMedia = async () => ({
        getTracks: () => [{ stop: () => {} }],
      });
      class FakeRecorder {
        state = 'inactive';
        ondataavailable: ((e: any) => void) | null = null;
        onstop: (() => void) | null = null;
        mimeType = 'audio/webm';
        start() { this.state = 'recording'; }
        stop() {
          this.state = 'inactive';
          this.ondataavailable?.({ data: new Blob(['mock'], { type: this.mimeType }) });
          this.onstop?.();
        }
        static isTypeSupported() { return true; }
      }
      (window as any).MediaRecorder = FakeRecorder;
    });

    await page.goto(INTELLIGENCE_URL);

    const mic = page.getByTestId('voice-mic-button');
    await mic.click();

    await expect(page.getByTestId('voice-input-bar')).toHaveAttribute('data-recording', 'true');

    // Stop immediately — the fake MediaRecorder produces a blob and the mocked
    // transcribe endpoint returns the canned transcript.
    await mic.click();

    const card = page.getByTestId('voice-confirmation-card');
    await expect(card).toBeVisible({ timeout: 5000 });
    await expect(card).toContainText('Log viewing');
    await expect(card).toContainText('Set reminder');
    await expect(card).toContainText('Draft vendor update');

    await page.getByTestId('voice-approve-all').click();

    await expect(card).toContainText('Done');
    await expect(page.getByTestId('voice-undo-pill')).toBeVisible();
  });
});

function nextMondayIso(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = (8 - day) % 7 || 7;
  d.setDate(d.getDate() + diff);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}
