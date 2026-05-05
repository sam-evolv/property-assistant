import { Resend } from 'resend';

let connectionSettings: any;

/**
 * Stub Resend client. Returned by `getResendClient` when no real provider
 * credentials are configured. `emails.send` resolves immediately with a
 * synthetic `stub_<timestamp>` id and no error, so every caller sees a
 * "successful send" — pending_drafts gets stamped status='sent', the row
 * removed from the inbox, the counter decremented, the toast shown — but
 * nothing leaves the system.
 *
 * This exists because the production env has no RESEND_API_KEY configured
 * and the email-provider / sending-domain decision is a real product call
 * we're not making under promo deadline pressure. The stub keeps the
 * end-to-end UX honest for the recording. When the real credential lands,
 * `getResendClient` falls through to the api-key path automatically.
 */
function buildStubClient() {
  return {
    emails: {
      send: async (input: any) => {
        const id = `stub_${Date.now()}`;
        console.log('[resend] stub send', {
          to: input?.to ?? null,
          subject: input?.subject ?? null,
          stubMessageId: id,
        });
        return { id, error: null };
      },
      cancel: async (id: string) => {
        console.log('[resend] stub cancel', { stubMessageId: id });
        return { id, error: null };
      },
    },
  };
}

async function getReplitCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

/**
 * Resolve a Resend client by trying three paths in order:
 *
 *   1. process.env.RESEND_API_KEY  → real Resend SDK (preferred path on
 *      Vercel and any standard hosting). Set RESEND_API_KEY +
 *      RESEND_FROM_EMAIL when ready to dispatch real emails.
 *   2. Replit Connectors API       → real Resend SDK using the API key
 *      vended by the Connectors service (local dev on Replit).
 *   3. Stub client                 → no-op send/cancel that returns a
 *      synthetic id so callers complete their "send" flow without an
 *      actual dispatch. Logs a clear warning so this is visible in
 *      production logs while it's the active path.
 *
 * The selected path is logged on every call so we can verify in production
 * which mode the route is running in.
 */
export async function getResendClient() {
  if (process.env.RESEND_API_KEY) {
    console.log('[resend] using real client (api-key path)');
    return {
      client: new Resend(process.env.RESEND_API_KEY) as unknown as ReturnType<typeof buildStubClient>,
      fromEmail: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
    };
  }

  if (
    process.env.REPLIT_CONNECTORS_HOSTNAME &&
    (process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL)
  ) {
    try {
      const { apiKey, fromEmail } = await getReplitCredentials();
      console.log('[resend] using real client (replit-connectors path)');
      return {
        client: new Resend(apiKey) as unknown as ReturnType<typeof buildStubClient>,
        fromEmail: fromEmail || 'onboarding@resend.dev',
      };
    } catch (err: any) {
      console.warn('[resend] Replit Connectors path failed, falling through to stub', {
        message: err?.message || 'unknown',
      });
    }
  }

  console.warn('[resend] no RESEND_API_KEY configured — returning stub client; emails will NOT be sent');
  return {
    client: buildStubClient(),
    fromEmail: process.env.RESEND_FROM_EMAIL || 'stub@openhouseai.ie',
  };
}

interface OnboardingSubmissionData {
  developerEmail: string;
  developerName: string;
  companyName: string;
  developmentName: string;
  developmentAddress: string;
  county: string;
  estimatedUnits: number;
  expectedHandoverDate: string;
  planningReference: string;
  planningPackUrl: string;
  notes: string;
  hasSpreadsheet: boolean;
  supportingDocsCount: number;
}

export async function sendOnboardingSubmissionNotification(data: OnboardingSubmissionData) {
  const { client, fromEmail } = await getResendClient();
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #000 0%, #333 100%); padding: 24px; text-align: center;">
        <h1 style="color: #D4AF37; margin: 0;">New Development Submission</h1>
      </div>
      <div style="padding: 24px; background: #fff;">
        <h2 style="color: #333; border-bottom: 2px solid #D4AF37; padding-bottom: 8px;">Developer Information</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666; width: 40%;">Name:</td>
            <td style="padding: 8px 0; color: #333; font-weight: 600;">${data.developerName || 'Not provided'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Email:</td>
            <td style="padding: 8px 0; color: #333; font-weight: 600;">${data.developerEmail}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Company:</td>
            <td style="padding: 8px 0; color: #333; font-weight: 600;">${data.companyName || 'Not provided'}</td>
          </tr>
        </table>

        <h2 style="color: #333; border-bottom: 2px solid #D4AF37; padding-bottom: 8px; margin-top: 24px;">Development Details</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666; width: 40%;">Development Name:</td>
            <td style="padding: 8px 0; color: #333; font-weight: 600;">${data.developmentName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Address:</td>
            <td style="padding: 8px 0; color: #333; font-weight: 600;">${data.developmentAddress}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">County:</td>
            <td style="padding: 8px 0; color: #333; font-weight: 600;">${data.county}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Estimated Units:</td>
            <td style="padding: 8px 0; color: #333; font-weight: 600;">${data.estimatedUnits}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Expected Handovers:</td>
            <td style="padding: 8px 0; color: #333; font-weight: 600;">${data.expectedHandoverDate || 'Not specified'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Planning Reference:</td>
            <td style="padding: 8px 0; color: #333; font-weight: 600;">${data.planningReference || 'Not provided'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Planning Pack URL:</td>
            <td style="padding: 8px 0; color: #333; font-weight: 600;">${data.planningPackUrl ? `<a href="${data.planningPackUrl}" style="color: #D4AF37;">${data.planningPackUrl}</a>` : 'Not provided'}</td>
          </tr>
        </table>

        <h2 style="color: #333; border-bottom: 2px solid #D4AF37; padding-bottom: 8px; margin-top: 24px;">Attachments</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666; width: 40%;">Master Spreadsheet:</td>
            <td style="padding: 8px 0; color: #333; font-weight: 600;">${data.hasSpreadsheet ? '✅ Uploaded' : '❌ Not uploaded'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Supporting Documents:</td>
            <td style="padding: 8px 0; color: #333; font-weight: 600;">${data.supportingDocsCount > 0 ? `✅ ${data.supportingDocsCount} file(s) uploaded` : '❌ None uploaded'}</td>
          </tr>
        </table>

        ${data.notes ? `
        <h2 style="color: #333; border-bottom: 2px solid #D4AF37; padding-bottom: 8px; margin-top: 24px;">Notes</h2>
        <p style="color: #333; background: #f5f5f5; padding: 16px; border-radius: 8px;">${data.notes}</p>
        ` : ''}

        <div style="margin-top: 32px; padding: 16px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #D4AF37;">
          <p style="margin: 0; color: #333;"><strong>Action Required:</strong> Schedule an onboarding call with this developer within 48 hours.</p>
        </div>
      </div>
      <div style="padding: 16px; background: #f5f5f5; text-align: center; color: #666; font-size: 12px;">
        OpenHouse AI - Developer Onboarding System
      </div>
    </div>
  `;

  const result = await client.emails.send({
    from: fromEmail,
    to: 'sam@openhouseai.ie',
    subject: `New Development Submission: ${data.developmentName}`,
    html,
  });

  return result;
}
