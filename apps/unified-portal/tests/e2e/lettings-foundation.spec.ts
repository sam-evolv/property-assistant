/**
 * Playwright smoke tests for Session 4B lettings foundation.
 *
 * Install & run once:
 *   npm i -D @playwright/test
 *   npx playwright install chromium
 *   npx playwright test tests/e2e/lettings-foundation.spec.ts
 *
 * Mocks transcribe/extract/execute + applicants APIs so the tests don't hit
 * Supabase, Claude or Resend. Covers:
 *   1. The canonical chain: voice -> log_rental_viewing +
 *      flag_applicant_preferred + draft_application_invitation, all three
 *      approved in one go. Confirmation summary mentions all three.
 *   2. Applicants list renders, filter pills switch, row opens detail view
 *      with the signals section.
 *   3. Partial failure: the draft step fails, the card shows ✓/✓/✗ per
 *      action with a Retry button that re-executes just the failed one.
 */
import { expect, test } from '@playwright/test';

const CANONICAL_TRANSCRIPT =
  "Three people came to see 14 Oakfield this afternoon, the O'Sheas were miles ahead, she's a teacher he's in the guards, ask them to apply.";

const LOG_VIEWING_ACTION = {
  id: 'act_log_1',
  type: 'log_rental_viewing',
  fields: {
    letting_property_id: '14 Oakfield',
    viewing_date: new Date().toISOString(),
    viewing_type: 'individual',
    attendees: [
      { name: "O'Shea", was_preferred: true, notes: 'Teacher + guard', employment_status: 'employed' },
      { name: 'Murphy' },
      { name: 'Kelly' },
    ],
    interest_level: 'high',
    feedback: 'Three parties viewed, one clear standout',
    next_action: 'Invite O\'Sheas to apply',
  },
  confidence: {
    letting_property_id: 0.85,
    viewing_date: 0.8,
    viewing_type: 0.8,
    attendees: 0.9,
    interest_level: 0.9,
    feedback: 0.85,
    next_action: 0.8,
  },
};

const FLAG_PREFERRED_ACTION = {
  id: 'act_flag_1',
  type: 'flag_applicant_preferred',
  fields: { applicant_name: "O'Shea" },
  confidence: { applicant_name: 0.95 },
};

const DRAFT_INVITE_ACTION = {
  id: 'act_invite_1',
  type: 'draft_application_invitation',
  fields: {
    applicant_name: "O'Shea",
    letting_property_id: '14 Oakfield',
    subject: 'Application for 14 Oakfield',
    body: "Hi {first_name}, lovely to meet you at 14 Oakfield today. When you have a moment, could you pop through the details at {application_link}?\n\nThanks,",
    tone: 'warm',
  },
  confidence: {
    applicant_name: 0.9,
    letting_property_id: 0.85,
    body: 0.8,
    tone: 0.8,
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

async function stubTranscribe(page: import('@playwright/test').Page) {
  await page.route('**/api/agent/intelligence/transcribe', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ transcript: CANONICAL_TRANSCRIPT, provider: 'mock' }),
    });
  });
}

async function stubExtract(page: import('@playwright/test').Page) {
  await page.route('**/api/agent/intelligence/extract-actions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        actions: [LOG_VIEWING_ACTION, FLAG_PREFERRED_ACTION, DRAFT_INVITE_ACTION],
        transcript: CANONICAL_TRANSCRIPT,
      }),
    });
  });
}

test.describe('Lettings foundation — canonical chain', () => {
  test('voice capture produces viewing + preference + draft actions in one card', async ({ page, context }) => {
    await context.grantPermissions(['microphone']);
    await patchMediaRecorder(page);
    await stubTranscribe(page);
    await stubExtract(page);

    await page.route('**/api/agent/intelligence/execute-actions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          batchId: 'batch_canonical',
          globalPaused: false,
          sharedContext: {
            applicantsByName: { "o'shea": 'applicant_oshea', murphy: 'applicant_murphy', kelly: 'applicant_kelly' },
            rentalViewingIds: { __latest: 'rv_1' },
            lettingPropertiesByRef: { '14 oakfield': 'prop_1' },
          },
          results: [
            {
              id: LOG_VIEWING_ACTION.id,
              type: LOG_VIEWING_ACTION.type,
              success: true,
              targetId: 'rv_1',
              message: 'Logged rental viewing at 14 Oakfield with 3 attendees',
              meta: { rentalViewingId: 'rv_1', applicantsByName: { "o'shea": 'applicant_oshea' } },
            },
            {
              id: FLAG_PREFERRED_ACTION.id,
              type: FLAG_PREFERRED_ACTION.type,
              success: true,
              targetId: 'attendee_1',
              message: "Flagged O'Shea as preferred",
            },
            {
              id: DRAFT_INVITE_ACTION.id,
              type: DRAFT_INVITE_ACTION.type,
              success: true,
              targetId: 'draft_1',
              message: "Drafted application invitation for O'Shea",
              meta: { applicationId: 'app_1', draftId: 'draft_1' },
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
    await expect(card).toContainText('Log rental viewing');
    await expect(card).toContainText("Flag O'Shea as preferred");
    await expect(card).toContainText("Invite O'Shea to apply");

    await page.getByTestId('voice-approve-all').click();

    await expect(page.getByText(/logged the rental viewing/i)).toBeVisible();
    await expect(page.getByText(/flagged O'Shea as preferred/i)).toBeVisible();
    await expect(page.getByText(/drafted the application invitation/i)).toBeVisible();
  });

  test('partial failure surfaces per-action status and retries the failed one', async ({ page, context }) => {
    await context.grantPermissions(['microphone']);
    await patchMediaRecorder(page);
    await stubTranscribe(page);
    await stubExtract(page);

    let executeHits = 0;
    await page.route('**/api/agent/intelligence/execute-actions', async (route) => {
      executeHits += 1;
      const body = JSON.parse(route.request().postData() || '{}');
      const actionIds = (body.actions || []).map((a: any) => a.id);

      if (executeHits === 1) {
        // Initial approval — draft step fails.
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            batchId: 'batch_partial',
            globalPaused: false,
            sharedContext: {
              applicantsByName: { "o'shea": 'applicant_oshea' },
              rentalViewingIds: { __latest: 'rv_1' },
              lettingPropertiesByRef: { '14 oakfield': 'prop_1' },
            },
            results: [
              { id: LOG_VIEWING_ACTION.id, type: LOG_VIEWING_ACTION.type, success: true, targetId: 'rv_1', message: 'Logged' },
              { id: FLAG_PREFERRED_ACTION.id, type: FLAG_PREFERRED_ACTION.type, success: true, targetId: 'att_1', message: 'Flagged' },
              { id: DRAFT_INVITE_ACTION.id, type: DRAFT_INVITE_ACTION.type, success: false, message: 'Could not save draft', error: 'resend_down' },
            ],
          }),
        });
        return;
      }

      // Retry — only the draft action was resent, include sharedContext echo.
      expect(actionIds).toEqual([DRAFT_INVITE_ACTION.id]);
      expect(body.sharedContext?.applicantsByName?.["o'shea"]).toBe('applicant_oshea');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          batchId: 'batch_partial',
          globalPaused: false,
          sharedContext: body.sharedContext,
          results: [
            { id: DRAFT_INVITE_ACTION.id, type: DRAFT_INVITE_ACTION.type, success: true, targetId: 'draft_retried', message: 'Drafted on retry' },
          ],
        }),
      });
    });

    await page.goto('/agent/intelligence');
    await page.getByTestId('voice-mic-button').click();
    await page.getByTestId('voice-mic-button').click();
    await page.getByTestId('voice-confirmation-card').waitFor();
    await page.getByTestId('voice-approve-all').click();

    // After initial approve: first two succeed, last one failed, Retry visible.
    await expect(page.getByTestId(`action-status-${LOG_VIEWING_ACTION.id}`)).toHaveAttribute('data-success', 'true');
    await expect(page.getByTestId(`action-status-${FLAG_PREFERRED_ACTION.id}`)).toHaveAttribute('data-success', 'true');
    await expect(page.getByTestId(`action-status-${DRAFT_INVITE_ACTION.id}`)).toHaveAttribute('data-success', 'false');

    const retry = page.getByTestId(`action-retry-${DRAFT_INVITE_ACTION.id}`);
    await expect(retry).toBeVisible();
    await retry.click();

    // After retry the draft flips to success.
    await expect(page.getByTestId(`action-status-${DRAFT_INVITE_ACTION.id}`)).toHaveAttribute('data-success', 'true');
    expect(executeHits).toBe(2);
  });
});

test.describe('Applicants page', () => {
  test('list renders and filter pills switch', async ({ page }) => {
    const allApplicants = [
      {
        id: 'a1',
        fullName: "Siobhan O'Shea",
        email: 'siobhan@example.ie',
        phone: null,
        source: 'walk_in',
        linkedPropertyCount: 1,
        latestStatus: 'invited',
        lastActivityAt: new Date().toISOString(),
        preferredCount: 1,
      },
      {
        id: 'a2',
        fullName: 'Peter Murphy',
        email: null,
        phone: '+35385111',
        source: 'daft',
        linkedPropertyCount: 0,
        latestStatus: null,
        lastActivityAt: new Date().toISOString(),
        preferredCount: 0,
      },
    ];

    await page.route('**/api/agent/applicants**', async (route) => {
      const url = new URL(route.request().url());
      const filter = url.searchParams.get('filter') || 'all';
      const filtered = filter === 'preferred' ? allApplicants.filter((a) => a.preferredCount > 0) : allApplicants;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ applicants: filtered, count: filtered.length }),
      });
    });

    await page.goto('/agent/applicants');
    await expect(page.getByTestId('applicants-list')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Siobhan O'Shea")).toBeVisible();
    await expect(page.getByText('Peter Murphy')).toBeVisible();

    await page.getByTestId('applicants-filter-preferred').click();
    await expect(page.getByText("Siobhan O'Shea")).toBeVisible();
    await expect(page.getByText('Peter Murphy')).not.toBeVisible();
  });

  test('detail view shows signals section', async ({ page }) => {
    await page.route('**/api/agent/applicants**', async (route) => {
      if (route.request().url().includes('badge-count')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0 }) });
        return;
      }
      if (route.request().url().endsWith('/api/agent/applicants') || route.request().url().includes('?filter')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ applicants: [], count: 0 }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          applicant: {
            id: 'a1',
            fullName: "Siobhan O'Shea",
            email: 'siobhan@example.ie',
            phone: '+35385222333',
            source: 'walk_in',
            linkedPropertyCount: 1,
            latestStatus: 'invited',
            lastActivityAt: new Date().toISOString(),
            preferredCount: 1,
            currentAddress: null,
            budgetMonthly: 1800,
            requestedMoveInDate: null,
            notes: null,
            signals: {
              employmentStatus: 'employed',
              employer: 'Dublin City Council',
              annualIncome: 48000,
              incomeToRentRatio: 2.2,
              householdSize: 2,
              hasPets: false,
              petDetails: null,
              smoker: false,
              referencesStatus: 'not_requested',
              amlStatus: 'not_started',
            },
            viewings: [
              {
                id: 'rv1',
                propertyAddress: '14 Oakfield',
                viewingDate: new Date().toISOString(),
                wasPreferred: true,
                interestLevel: 'high',
              },
            ],
            applications: [
              {
                id: 'app1',
                propertyAddress: '14 Oakfield',
                rentPcm: 1800,
                status: 'invited',
                referencesStatus: 'not_requested',
                amlStatus: 'not_started',
                applicationDate: new Date().toISOString(),
              },
            ],
          },
        }),
      });
    });

    await page.goto('/agent/applicants/a1');
    await expect(page.getByTestId('applicant-signals')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('applicant-signals')).toContainText('Dublin City Council');
    await expect(page.getByTestId('applicant-signals')).toContainText('2.2x annual rent');
    await expect(page.getByTestId('applicant-invite-cta')).toBeVisible();
  });
});
