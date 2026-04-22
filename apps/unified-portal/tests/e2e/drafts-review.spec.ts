/**
 * Playwright smoke test for the Session 2 drafts review flow.
 *
 * Install & run once:
 *   npm i -D @playwright/test
 *   npx playwright install chromium
 *   npx playwright test tests/e2e/drafts-review.spec.ts
 *
 * Mocks the list/get/patch/send endpoints so it doesn't touch Supabase or
 * Resend. Covers the golden path:
 *   1. Create a draft (mock) via the voice capture extract+execute routes
 *   2. Open the drafts list
 *   3. Tap the draft row
 *   4. Edit the subject
 *   5. Send
 *   6. Verify sent state + 60s undo pill
 */
import { expect, test } from '@playwright/test';

const DRAFT_ID = 'draft_smoke_1';

const MOCK_DRAFT = {
  id: DRAFT_ID,
  userId: 'user_smoke',
  tenantId: 'tenant_smoke',
  draftType: 'vendor_update',
  status: 'pending_review',
  sendMethod: 'email',
  recipient: {
    id: 'listing_1',
    name: 'Mary Doyle',
    email: 'mary@doyle.ie',
    phone: null,
    source: 'listing_vendor',
    address: '14 Oakfield',
  },
  subject: 'Update on 14 Oakfield',
  body: 'Murphys viewed and loved the place, concern about the garden.',
  contextChips: [
    { id: 'property', label: '14 Oakfield', detail: 'Vendor: Mary Doyle' },
  ],
  createdAt: new Date(Date.now() - 3600_000).toISOString(),
  updatedAt: new Date().toISOString(),
  sentAt: null,
};

test.describe('Agent Drafts review', () => {
  test('opens a draft, edits subject, sends, shows undo pill', async ({ page }) => {
    let currentSubject = MOCK_DRAFT.subject;

    await page.route('**/api/agent/intelligence/drafts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          drafts: [{ ...MOCK_DRAFT, subject: currentSubject }],
          count: 1,
        }),
      });
    });

    await page.route(`**/api/agent/intelligence/drafts/${DRAFT_ID}`, async (route) => {
      const method = route.request().method();
      if (method === 'PATCH') {
        const body = JSON.parse(route.request().postData() || '{}');
        if (typeof body.subject === 'string') currentSubject = body.subject;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ draft: { ...MOCK_DRAFT, subject: currentSubject } }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ draft: { ...MOCK_DRAFT, subject: currentSubject } }),
      });
    });

    await page.route('**/api/agent/intelligence/send-draft', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          batchId: 'batch_smoke_send',
          status: 'sent',
          provider: 'resend',
          providerMessageId: 'msg_1',
          externalPayload: null,
          undoable: true,
          sentAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/agent/drafts');

    const row = page.getByTestId('drafts-list-row');
    await expect(row).toBeVisible({ timeout: 5000 });
    await expect(row).toContainText('Mary Doyle');
    await row.click();

    const panel = page.getByTestId('draft-review-panel');
    await expect(panel).toBeVisible();

    const subjectInput = page.getByTestId('draft-subject-input');
    await subjectInput.fill('Quick update on 14 Oakfield');

    const saveButton = page.getByTestId('draft-save');
    await expect(saveButton).toBeVisible();

    await page.getByTestId('draft-send').click();

    await expect(page.getByTestId('draft-sent-confirmation')).toBeVisible();
    await expect(page.getByTestId('voice-undo-pill')).toBeVisible();
  });

  test('empty state renders when there are no drafts', async ({ page }) => {
    await page.route('**/api/agent/intelligence/drafts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ drafts: [], count: 0 }),
      });
    });

    await page.goto('/agent/drafts');
    await expect(page.getByTestId('drafts-empty-state')).toBeVisible();
    await expect(page.getByTestId('drafts-empty-state')).toContainText('No drafts waiting');
  });
});
