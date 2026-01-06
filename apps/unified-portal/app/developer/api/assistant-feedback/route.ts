import { NextRequest, NextResponse } from 'next/server';
import { logFeedback, getFeedbackSummary, canCaptureFeedback } from '@/lib/assistant/feedback-logger';
import { db } from '@openhouse/db/client';
import { scheme_profile } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';

async function getSchemeWithTenant(schemeId: string): Promise<{ tenant_id: string } | null> {
  try {
    const result = await db
      .select({ tenant_id: scheme_profile.developer_org_id })
      .from(scheme_profile)
      .where(eq(scheme_profile.id, schemeId))
      .limit(1);
    return result[0] || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const isTestMode = request.headers.get('X-Test-Mode') === 'true';
    const body = await request.json();
    const { 
      scheme_id, 
      unit_id, 
      user_question, 
      assistant_response, 
      source_type, 
      feedback_value,
      user_role,
      session_id,
    } = body;
    
    if (!canCaptureFeedback(isTestMode, user_role)) {
      return NextResponse.json({ 
        error: 'Feedback capture not available for this user' 
      }, { status: 403 });
    }
    
    if (!scheme_id || !user_question || !assistant_response || !feedback_value) {
      return NextResponse.json({ 
        error: 'Missing required fields: scheme_id, user_question, assistant_response, feedback_value' 
      }, { status: 400 });
    }
    
    if (feedback_value !== 'up' && feedback_value !== 'down') {
      return NextResponse.json({ 
        error: 'feedback_value must be "up" or "down"' 
      }, { status: 400 });
    }
    
    const scheme = await getSchemeWithTenant(scheme_id);
    if (!scheme) {
      return NextResponse.json({ error: 'Scheme not found' }, { status: 404 });
    }
    
    const result = await logFeedback({
      tenant_id: scheme.tenant_id,
      scheme_id,
      unit_id,
      user_question,
      assistant_response,
      source_type: source_type || 'unknown',
      feedback_value,
      user_role,
      session_id,
    });
    
    return NextResponse.json({ success: result.success, id: result.id });
  } catch (error) {
    console.error('[API] Error logging feedback:', error);
    return NextResponse.json({ error: 'Failed to log feedback' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schemeId = searchParams.get('schemeId');
    
    if (!schemeId) {
      return NextResponse.json({ error: 'schemeId is required' }, { status: 400 });
    }
    
    const scheme = await getSchemeWithTenant(schemeId);
    if (!scheme) {
      return NextResponse.json({ error: 'Scheme not found' }, { status: 404 });
    }
    
    const summary = await getFeedbackSummary(scheme.tenant_id, schemeId);
    return NextResponse.json({ summary });
  } catch (error) {
    console.error('[API] Error fetching feedback summary:', error);
    return NextResponse.json({ error: 'Failed to fetch feedback summary' }, { status: 500 });
  }
}
