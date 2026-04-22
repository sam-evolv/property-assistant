/**
 * Playwright smoke tests for the Session 3 auto-send flow.
 *
 * Install & run once:
 *   npm i -D @playwright/test
 *   npx playwright install chromium
 *   npx playwright test tests/e2e/auto-send.spec.ts
 *
 * Mocks transcribe/extract/execute/send/cancel endpoints so the test doesn't
 * touch Supabase, Deepgram, Claude or Resend. Covers:
 *   1. Countdown -> auto-send succeeds -> undo pill visible
 *   2. Countdown -> Cancel clicked -> "Held for review" banner + cancel API
 *      hit
 */
import { expect, test } from '@playwright/test';

const TRANSCRIPT = 'Tell the vendor of 14 Oakfield we had a great viewing today.';

const ACTION = {
  id: 'act_auto_1',
  type: 'draft_vendor_update',
  fields: {
    vendor_id: '14 Oakfield',
    update_summary: 'Great viewing today, strong interest.',
    tone: 'casual',
    send_method: 'email',
  },
  confidence: {
    vendor_id: 0.9,
    update_summary: 0.85,
    tone: 0.9,
    send_method: 0.9,
  },
};

const AUTO_SEND_EXECUTE_RESPONSE = {
  batchId: 'batch_auto',
  globalPaused: false,
  results: [
    {
      id: ACTION.id,
      type: ACTION.type,
      success: true,
      targetId: 'draft_auto_1',
      message: 'Auto-sending vendor update to Mary Doyle',
      autoSendPlan: {
        draftId: 'draft_auto_1',
        draftType: 'vendor_update',
        countdownSeconds: 2, // short so the test doesn't wait 10 real seconds
        recipientName: 'Mary Doyle',
      },
    },
  ],
};

async function stubCommonRoutes(page: import('@playwright/test').Page) {
  await page.route('**/api/agent/intelligence/transcribe', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ transcript: TRANSCRIPT, provider: 'mock' }),
    });
  });

  await page.route('**/api/agent/intelligence/extract-actions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ actions: [ACTION], transcript: TRANSCRIPT }),
    });
  });

  await page.route('**/api/agent/intelligence/execute-actions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(AUTO_SEND_EXECUTE_RESPONSE),
    });
  });
}

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

test.describe('Auto-send countdown', () => {
  test('elapses and auto-sends, showing success banner + undo pill', async ({ page, context }) => {
    await context.grantPermissions(['microphone']);
    await patchMediaRecorder(page);
    await stubCommonRoutes(page);

    await page.route('**/api/agent/intelligence/send-draft', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          batchId: 'batch_sent',
          status: 'sent',
          provider: 'resend',
          providerMessageId: 'msg_auto_1',
          externalPayload: null,
          undoable: true,
          sentAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/agent/intelligence');

    const mic = page.getByTestId('voice-mic-button');
    await mic.click();
    await mic.click(); // stop immediately — mocked transcript fires

    const card = page.getByTestId('voice-confirmation-card');
    await expect(card).toBeVisible({ timeout: 5000 });
    await page.getByTestId('voice-approve-all').click();

    const countdown = page.getByTestId('auto-send-countdown');
    await expect(countdown).toBeVisible();

    // Wait for countdown to elapse; the send should fire automatically.
    await expect(page.getByTestId('auto-send-success-banner')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('voice-undo-pill')).toBeVisible();
  });

  test('cancel click holds the draft and calls cancel-auto-send', async ({ page, context }) => {
    await context.grantPermissions(['microphone']);
    await patchMediaRecorder(page);
    await stubCommonRoutes(page);

    let cancelled = false;
    await page.route('**/api/agent/intelligence/cancel-auto-send', async (route) => {
      cancelled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ cancelled: true }),
      });
    });
    // Should never be hit once Cancel wins.
    await page.route('**/api/agent/intelligence/send-draft', async (route) => {
      await route.fulfill({ status: 500, body: 'should not fire' });
    });

    await page.goto('/agent/intelligence');

    await page.getByTestId('voice-mic-button').click();
    await page.getByTestId('voice-mic-button').click();
    await page.getByTestId('voice-approve-all').click();

    await expect(page.getByTestId('auto-send-countdown')).toBeVisible();
    await page.getByTestId('auto-send-cancel').click();

    await expect(page.getByTestId('auto-send-cancelled-banner')).toBeVisible();
    expect(cancelled).toBe(true);
  });
});
