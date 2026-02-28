import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function buildSystemPrompt(installation: any, installerName: string): string {
  return `You are a helpful solar energy assistant for ${installerName}. You help homeowners understand and troubleshoot their solar PV installation.

INSTALLATION DETAILS:
- System Type: ${installation.system_type || 'Solar PV'}
- Inverter Model: ${installation.inverter_model || 'Unknown'}
- Panel Model: ${installation.panel_model || 'Unknown'}
- System Size: ${installation.system_size_kwp ? `${installation.system_size_kwp} kWp` : 'Unknown'}
- Panel Count: ${installation.panel_count || 'Unknown'}
- Install Date: ${installation.install_date || 'Unknown'}
- Installer: ${installerName}

RULES:
- Be helpful, concise, and use simple language for homeowners.
- If you cannot answer a question confidently, suggest using the diagnostic tool or contacting the installer directly.
- Never make up specifications, warranty details, or technical data that you do not have.
- Focus on practical advice the homeowner can act on.
- Keep responses under 200 words where possible.`;
}

function getFallbackResponse(message: string): { response: string; sources: string[] } {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('red light') || lowerMessage.includes('error light') || lowerMessage.includes('fault')) {
    return {
      response: 'A red or flashing light on your inverter usually indicates a fault. Try these steps: 1) Turn your AC isolator switch OFF, 2) Wait 30 seconds, 3) Turn it back ON. If the red light persists after 5 minutes, please use our diagnostic tool or contact your installer for a technician visit.',
      sources: ['fallback_knowledge_base'],
    };
  }

  if (lowerMessage.includes('no power') || lowerMessage.includes('not generating') || lowerMessage.includes('no generation')) {
    return {
      response: 'If your system is not generating power, first check: 1) Is it daytime with some sunlight? Solar panels need daylight. 2) Check the inverter - is it showing a green light? 3) Try restarting by toggling the AC isolator OFF for 30 seconds then ON. If the issue persists, please use our diagnostic tool for step-by-step troubleshooting.',
      sources: ['fallback_knowledge_base'],
    };
  }

  if (lowerMessage.includes('bill') || lowerMessage.includes('saving') || lowerMessage.includes('cost')) {
    return {
      response: 'Your solar savings depend on how much energy you use during daylight hours (self-consumption). To maximise savings: 1) Run high-energy appliances (washing machine, dishwasher) during the day, 2) Check your energy tariff - a good export rate can boost savings, 3) Monitor your generation through your inverter app. If your bills seem higher than expected, please use our Energy Bill Concerns diagnostic tool.',
      sources: ['fallback_knowledge_base'],
    };
  }

  if (lowerMessage.includes('clean') || lowerMessage.includes('maintenance') || lowerMessage.includes('wash')) {
    return {
      response: 'Solar panels generally require very little maintenance. Rain usually keeps them clean enough. If you notice significant dirt or bird droppings, you can gently rinse them with a garden hose from ground level. Never use abrasive cleaners, pressure washers, or climb on the roof. For a thorough clean, contact your installer who can arrange professional panel cleaning.',
      sources: ['fallback_knowledge_base'],
    };
  }

  if (lowerMessage.includes('warranty') || lowerMessage.includes('guarantee')) {
    return {
      response: 'Your installation typically comes with multiple warranties: panel performance warranty (usually 25 years), inverter warranty (10-12 years depending on brand), and workmanship warranty from your installer. For specific warranty details and claims, please contact your installer directly as they can look up your exact warranty terms.',
      sources: ['fallback_knowledge_base'],
    };
  }

  return {
    response: 'Thank you for your question. I am not fully confident in providing an accurate answer on this topic. I would recommend: 1) Try our diagnostic tool for step-by-step troubleshooting, or 2) Contact your installer directly for specialist advice. They will be happy to help with your specific question.',
    sources: ['fallback_generic'],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { installation_id, message } = body;

    if (!installation_id || !message) {
      return NextResponse.json(
        { error: 'installation_id and message are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. Look up installation with tenant info
    const { data: installation, error: installError } = await supabase
      .from('installations')
      .select('*, tenants(id, name, slug, contact)')
      .eq('id', installation_id)
      .single();

    if (installError || !installation) {
      console.error('[Care Chat] Installation lookup error:', installError);
      return NextResponse.json(
        { error: 'Installation not found' },
        { status: 404 }
      );
    }

    const tenantId = installation.tenant_id;
    const installerName = (installation.tenants as any)?.name || 'your installer';

    // 2. Fetch installer content as knowledge base context
    const { data: contentItems } = await supabase
      .from('installer_content')
      .select('title, description, content_type, category, brand, model')
      .eq('tenant_id', tenantId)
      .eq('status', 'live');

    const knowledgeBase = (contentItems || [])
      .map((c) => `- ${c.title}: ${c.description || ''}`)
      .join('\n');

    // 3. Build system prompt
    const systemPrompt = buildSystemPrompt(installation, installerName)
      + (knowledgeBase
        ? `\n\nAVAILABLE KNOWLEDGE BASE CONTENT:\n${knowledgeBase}\n\nRefer to these resources when relevant.`
        : '');

    // 4. Attempt OpenAI call
    let aiResponse: string | null = null;
    const sources: string[] = [];

    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      aiResponse = completion.choices[0]?.message?.content || null;

      if (aiResponse) {
        sources.push('ai');
        if (contentItems && contentItems.length > 0) {
          sources.push('installer_knowledge_base');
        }
      }
    } catch (openaiError) {
      console.error('[Care Chat] OpenAI error, falling back to keyword matching:', openaiError);
    }

    // 5. Fallback to keyword matching if OpenAI failed
    if (!aiResponse) {
      const fallback = getFallbackResponse(message);
      aiResponse = fallback.response;
      sources.push(...fallback.sources);
    }

    // 6. Log to support_queries
    const { error: logError } = await supabase
      .from('support_queries')
      .insert({
        installation_id,
        tenant_id: tenantId,
        query_text: message,
        ai_response: aiResponse,
        response_source: sources.includes('ai') ? 'ai' : 'fallback',
        resolved: true,
      });

    if (logError) {
      console.error('[Care Chat] Failed to log support query:', logError);
      // Non-blocking: still return the response even if logging fails
    }

    return NextResponse.json({
      response: aiResponse,
      sources,
    });
  } catch (error) {
    console.error('[Care Chat] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
