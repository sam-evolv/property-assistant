import { NextRequest, NextResponse } from 'next/server';
import { getResendClient } from '@/lib/resend';

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
              <td style="padding: 8px; border: 1px solid #ddd;">${fullName || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Email</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${email || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Phone</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${phone || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Company Name</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${companyName || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Invitation Code Used</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${code || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Timestamp</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${timestamp}</td>
            </tr>
          </table>
        `,
      });

      console.log('[New Signup Notification] Email sent successfully for:', email);
      return NextResponse.json({ success: true, method: 'email' });
    } catch (emailError) {
      console.error('[New Signup Notification] Email failed, logging to console:', emailError);
      console.log('=== NEW DEVELOPER SIGNUP ===');
      console.log('Name:', fullName);
      console.log('Email:', email);
      console.log('Phone:', phone);
      console.log('Company:', companyName);
      console.log('Code Used:', code);
      console.log('Timestamp:', timestamp);
      console.log('============================');
      return NextResponse.json({ success: true, method: 'console' });
    }
  } catch (error) {
    console.error('[New Signup Notification] Error:', error);
    return NextResponse.json({ success: false, error: 'Notification failed' }, { status: 500 });
  }
}
