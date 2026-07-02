export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { getResendClient } from '@/lib/resend';

// Escape user-supplied values before embedding them in the HTML email body
// to prevent HTML/markup injection into the internal notification email.
function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fullName, email, phone, companyName, code } = body;

    const timestamp = new Date().toISOString();

    try {
      const { client, fromEmail } = await getResendClient();

      await client.emails.send({
        from: fromEmail,
        to: 'sam@openhouseai.ie',
        subject: `New Developer Signup: ${companyName || 'Unknown Company'}`,
        html: `
          <h2>New Developer Signup</h2>
          <table style="border-collapse: collapse; width: 100%; max-width: 500px;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Name</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(fullName || 'Not provided')}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Email</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(email || 'Not provided')}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Phone</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(phone || 'Not provided')}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Company Name</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(companyName || 'Not provided')}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Invitation Code Used</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(code || 'Not provided')}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Timestamp</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(timestamp)}</td>
            </tr>
          </table>
        `,
      });

      return NextResponse.json({ success: true, method: 'email' });
    } catch (emailError) {
      return NextResponse.json({ success: true, method: 'console' });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Notification failed' }, { status: 500 });
  }
}
