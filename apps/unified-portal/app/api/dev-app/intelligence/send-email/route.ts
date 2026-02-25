import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { message_id, conversation_id } = body;

    if (!message_id || !conversation_id) {
      return NextResponse.json(
        { error: 'message_id and conversation_id required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Get the email draft message
    const { data: message } = await admin
      .from('intelligence_messages')
      .select('structured_data, conversation_id')
      .eq('id', message_id)
      .single();

    if (!message?.structured_data) {
      return NextResponse.json(
        { error: 'Email draft not found' },
        { status: 404 }
      );
    }

    const draft = message.structured_data;

    // Log the action (actual email sending would use Resend/SendGrid in production)
    await admin.from('intelligence_actions').insert({
      conversation_id,
      message_id,
      developer_id: user.id,
      action_type: 'email_sent',
      action_status: 'completed',
      description: `Sent email to ${draft.to} re: ${draft.subject}`,
      metadata: {
        to: draft.to,
        subject: draft.subject,
        body: draft.body,
        related_units: draft.related_units,
      },
    });

    // Update the message to mark as sent
    await admin
      .from('intelligence_messages')
      .update({
        structured_data: {
          ...draft,
          sent: true,
          sent_at: new Date().toISOString(),
        },
      })
      .eq('id', message_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[dev-app/intelligence/send-email] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
