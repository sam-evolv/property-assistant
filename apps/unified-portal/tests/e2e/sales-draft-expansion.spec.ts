/**
 * Playwright smoke tests for Session 4A sales draft expansion.
 *
 * Install & run once:
 *   npm i -D @playwright/test
 *   npx playwright install chromium
 *   npx playwright test tests/e2e/sales-draft-expansion.spec.ts
 *
 * Mocks transcribe/extract/execute so the test doesn't hit Supabase, Claude
 * or Resend. Covers:
 *   1. Voice capture -> draft_offer_response -> card renders with the
 *      counter amount, approve -> confirmation text + undo pill
 *   2. Voice capture -> draft_price_reduction_notice on 3 buyers -> card
 *      reports the fanout, approve -> "drafted for 3 buyers" summary
 */
import { expect, test } from '@playwright/test';

const TRANSCRIPT = 'Counter the Murphys at 450 on 14 Oakfield, firm tone.';

const OFFER_RESPONSE_ACTION = {
  id: 'act_offer_1',
  type: 'draft_offer_response',
  fields: {
    offer_id: 'Murphys offer on 14 Oakfield',
    recipient_id: 'Murphys',
    action: 'counter',
    counter_amount: 450000,
    counter_conditions: '',
    subject: 'On your offer on 14 Oakfield',
    body: 'Thanks for the offer. The vendor would like to counter at 450,000.',
    tone: 'firm',
  },
  confidence: {
    offer_id: 0.8,
    recipient_id: 0.85,
    action: 0.95,
    counter_amount: 0.9,
    subject: 0.85,
    body: 0.8,
    tone: 0.8,
  },
};

const PRICE_REDUCTION_ACTION = {
  id: 'act_price_1',
  type: 'draft_price_reduction_notice',
  fields: {
    property_id: '14 Oakfield',
    old_price: 475000,
    new_price: 450000,
    recipient_ids: ['Mary Doyle', 'John Kelly', 'Sinead Ryan'],
    subject: 'Price update on 14 Oakfield',
    body_template: 'Hi {first_name}, quick heads up — 14 Oakfield is now 450,000.',
  },
  confidence: {
    property_id: 0.9,
    old_price: 0.85,
    new_price: 0.9,
    recipient_ids: 0.75,
    body_template: 0.8,
  },
};

async function patchMediaRecorder(page: import('@playwright/test').Page) {
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
}

async function stubTranscription(page: import('@playwright/test').Page) {
  await page.route('**/api/agent/intelligence/transcribe', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ transcript: TRANSCRIPT, provider: 'mock' }),
    });
  });
}

test.describe('Sales draft expansion', () => {
  test('draft_offer_response counter surfaces amount + lands draft', async ({ page, context }) => {
    await context.grantPermissions(['microphone']);
    await patchMediaRecorder(page);
    await stubTranscription(page);

    await page.route('**/api/agent/intelligence/extract-actions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ actions: [OFFER_RESPONSE_ACTION], transcript: TRANSCRIPT }),
      });
    });

    let executeHits = 0;
    await page.route('**/api/agent/intelligence/execute-actions', async (route) => {
      executeHits += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          batchId: 'batch_offer',
          globalPaused: false,
          results: [
            {
              id: OFFER_RESPONSE_ACTION.id,
              type: OFFER_RESPONSE_ACTION.type,
              success: true,
              targetId: 'draft_offer_1',
              message: 'Drafted offer counter for Murphys',
              autoSendPlan: null,
              autoSendHold: null,
            },
          ],
        }),
      });
    });

    await page.goto('/agent/intelligence');
    await page.getByTestId('voice-mic-button').click();
    await page.getByTestId('voice-mic-button').click();

    const card = page.getByTestId('voice-confirmation-card');
    await expect(card).toBeVisible({ timeout: 5000 });
    await expect(card).toContainText('Draft counter-offer');
    await expect(card).toContainText('450000'); // counter_amount present in field row

    await page.getByTestId('voice-approve-all').click();

    // Natural-language summary + undo pill.
    await expect(page.getByText(/counter-offer at €450,000/i)).toBeVisible();
    await expect(page.getByTestId('voice-undo-pill')).toBeVisible();
    expect(executeHits).toBe(1);
  });

  test('draft_price_reduction_notice fans out to 3 buyers', async ({ page, context }) => {
    await context.grantPermissions(['microphone']);
    await patchMediaRecorder(page);
    await stubTranscription(page);

    await page.route('**/api/agent/intelligence/extract-actions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ actions: [PRICE_REDUCTION_ACTION], transcript: TRANSCRIPT }),
      });
    });

    await page.route('**/api/agent/intelligence/execute-actions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          batchId: 'batch_price',
          globalPaused: false,
          results: [
            {
              id: PRICE_REDUCTION_ACTION.id,
              type: PRICE_REDUCTION_ACTION.type,
              success: true,
              targetId: 'draft_price_1',
              targetIds: ['draft_price_1', 'draft_price_2', 'draft_price_3'],
              recipientCount: 3,
              message: 'Drafted price reduction notice for 3 buyers',
              autoSendPlan: null,
              autoSendHold: null,
            },
          ],
        }),
      });
    });

    await page.goto('/agent/intelligence');
    await page.getByTestId('voice-mic-button').click();
    await page.getByTestId('voice-mic-button').click();

    const card = page.getByTestId('voice-confirmation-card');
    await expect(card).toBeVisible({ timeout: 5000 });
    await expect(card).toContainText('Draft price reduction notice');
    await expect(card).toContainText('3 buyers');

    await page.getByTestId('voice-approve-all').click();

    await expect(page.getByText(/drafted the price reduction notice for 3 buyers/i)).toBeVisible();
  });
});
