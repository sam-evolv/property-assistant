import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
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

export async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail: fromEmail || 'onboarding@resend.dev'
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

  console.log('[Resend] Onboarding notification sent:', result);
  return result;
}
