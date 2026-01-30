// /api/super/assistant/test/route.ts - Routes through real chat API for accurate testing
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase-server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    await requireRole(['super_admin', 'admin']);
    
    const body = await request.json();
    const { development_id, message, include_custom_qa } = body;

    if (!development_id || !message) {
      return NextResponse.json({ error: 'development_id and message required' }, { status: 400 });
    }

    // Get a unit from this development to use for testing
    // First try Drizzle units table
    const { data: drizzleUnit } = await supabaseAdmin
      .from('units')
      .select('id, unit_uid, development_id')
      .eq('development_id', development_id)
      .limit(1)
      .single();

    let unitUid: string | null = null;

    if (drizzleUnit?.unit_uid) {
      unitUid = drizzleUnit.unit_uid;
    } else {
      // Fallback: try to find any unit linked to this development through projects
      const { data: development } = await supabaseAdmin
        .from('developments')
        .select('id, name')
        .eq('id', development_id)
        .single();

      if (development) {
        // Try to find project linked to this development
        const { data: project } = await supabaseAdmin
          .from('projects')
          .select('id')
          .ilike('name', `%${development.name}%`)
          .limit(1)
          .single();

        if (project) {
          const { data: supabaseUnit } = await supabaseAdmin
            .from('units')
            .select('id, unit_uid')
            .eq('project_id', project.id)
            .limit(1)
            .single();

          if (supabaseUnit?.unit_uid) {
            unitUid = supabaseUnit.unit_uid;
          } else if (supabaseUnit?.id) {
            unitUid = supabaseUnit.id;
          }
        }
      }
    }

    if (!unitUid) {
      // No unit found - cannot route through real chat API
      // Return a helpful error message
      return NextResponse.json({ 
        error: 'No units found for this development. Please add at least one unit to test the assistant with real RAG and documents.',
        response: 'Unable to test: No units have been assigned to this development yet. The assistant test requires at least one unit to provide proper context for document retrieval.',
        diagnostics: {
          development_id,
          used_real_rag: false,
          reason: 'no_units_found',
        },
      });
    }

    // Build the request URL for the real chat endpoint
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const host = request.headers.get('host') || 'localhost:5000';
    const chatUrl = `${protocol}://${host}/api/chat`;

    // Make request to real chat API
    const chatResponse = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        message,
        unitUid,
        userId: 'super-admin-test',
        hasBeenWelcomed: true,
        language: 'en',
      }),
    });

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text();
      console.error('[Assistant Test] Chat API error:', chatResponse.status, errorText);
      return NextResponse.json({ 
        error: 'Chat API returned error', 
        details: errorText 
      }, { status: chatResponse.status });
    }

    // Parse the real chat response
    const chatData = await chatResponse.json();

    // Return the response in a consistent format
    return NextResponse.json({
      response: chatData.answer || chatData.response || chatData.message || 'No response generated',
      sources: chatData.sources || [],
      diagnostics: {
        unit_used: unitUid,
        development_id,
        used_real_rag: true,
        chat_diagnostics: chatData.diagnostics,
      },
    });
  } catch (err) {
    console.error('Error testing assistant:', err);
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 });
  }
}
