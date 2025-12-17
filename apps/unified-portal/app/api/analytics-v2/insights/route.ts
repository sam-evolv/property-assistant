import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });
}

interface InsightRequest {
  sectionName: string;
  metrics: Record<string, any>;
  tenantId: string;
}

const INSIGHT_PROMPTS: Record<string, string> = {
  overview: `Based on the following analytics metrics, provide a concise (2-3 sentence) AI insight about the overall platform performance and any actionable recommendations. Focus on the most important trends.`,
  trends: `Based on the trend metrics provided, identify the key growth patterns and potential areas of concern. Provide a brief insight (2-3 sentences) with recommendations.`,
  questions: `Analyzing the top questions and patterns, identify the primary user needs and knowledge gaps. Provide a brief insight (2-3 sentences) about what content or features might help.`,
  documents: `Based on document health and usage metrics, assess the quality of the knowledge base and recommend which documents need attention or updating.`,
  rag: `Analyzing RAG performance metrics, provide an insight on retrieval effectiveness and any optimization opportunities.`,
};

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    await requireRole(['developer', 'admin', 'super_admin']);

    const body = await request.json() as InsightRequest;
    const { sectionName, metrics, tenantId } = body;

    if (!sectionName || !metrics || !tenantId) {
      return NextResponse.json(
        { error: 'Missing required fields: sectionName, metrics, tenantId' },
        { status: 400 }
      );
    }

    // Get the appropriate prompt for this section
    const basePrompt = INSIGHT_PROMPTS[sectionName] || INSIGHT_PROMPTS.overview;

    // Format metrics into a readable string
    const metricsStr = Object.entries(metrics)
      .map(([key, value]) => {
        if (typeof value === 'number') {
          return `${key}: ${value.toLocaleString()}`;
        } else if (typeof value === 'object') {
          return `${key}: ${JSON.stringify(value)}`;
        }
        return `${key}: ${value}`;
      })
      .join('\n');

    const fullPrompt = `${basePrompt}

Analytics Metrics:
${metricsStr}

Provide your insight in a clear, actionable format.`;

    // Call OpenAI to generate insight
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an analytics expert providing brief, actionable insights about platform performance. Keep responses concise (2-3 sentences) and focus on actionable insights.',
        },
        {
          role: 'user',
          content: fullPrompt,
        },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    const insight = completion.choices[0]?.message?.content || 'Insights are currently being analyzed.';

    return NextResponse.json({
      success: true,
      insight,
    });
  } catch (error) {
    console.error('[Analytics Insights Error]:', error);
    
    // Return a graceful fallback instead of error
    return NextResponse.json({
      success: true,
      insight: 'Analytics insights are being generated. Platform is operating normally.',
    });
  }
}
