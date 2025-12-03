import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface InsightCache {
  insight: string;
  generatedAt: Date;
  expiresAt: Date;
}

const insightCache = new Map<string, InsightCache>();

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate AI-powered insights for analytics sections
 * Results are cached for 24 hours
 */
export async function generateInsightFor(
  sectionName: string,
  metrics: Record<string, any>
): Promise<string> {
  const cacheKey = `${sectionName}-${JSON.stringify(metrics).substring(0, 100)}`;
  
  const cached = insightCache.get(cacheKey);
  if (cached && cached.expiresAt > new Date()) {
    return cached.insight;
  }

  try {
    const prompt = buildPromptForSection(sectionName, metrics);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an AI analytics assistant for OpenHouse AI, a property management platform. Generate concise, actionable insights based on the provided metrics. Keep insights to 1-2 sentences. Be specific and data-driven.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    const insight = completion.choices[0]?.message?.content || 'No insight available at this time.';
    
    const now = new Date();
    insightCache.set(cacheKey, {
      insight,
      generatedAt: now,
      expiresAt: new Date(now.getTime() + CACHE_DURATION_MS),
    });

    return insight;
  } catch (error) {
    console.error('[InsightsEngine] Failed to generate insight:', error);
    return 'Insights temporarily unavailable. Please check back later.';
  }
}

function buildPromptForSection(sectionName: string, metrics: Record<string, any>): string {
  const metricsSummary = JSON.stringify(metrics, null, 2);
  
  const prompts: Record<string, string> = {
    overview: `Based on these overall analytics metrics for the last 30 days, provide one key insight or recommendation:\n\n${metricsSummary}`,
    
    trends: `Based on these trend metrics showing message volume and engagement patterns, provide one key insight:\n\n${metricsSummary}`,
    
    homeowners: `Based on these homeowner engagement metrics, identify the most important pattern or opportunity:\n\n${metricsSummary}`,
    
    documents: `Based on these document health and usage metrics, provide one actionable recommendation:\n\n${metricsSummary}`,
    
    rag_performance: `Based on these RAG performance metrics (latency, retrieval success, embeddings), identify the biggest opportunity for improvement:\n\n${metricsSummary}`,
    
    knowledge_gaps: `Based on these knowledge gap indicators (repeated questions, confusion points), what's the most urgent content gap to address:\n\n${metricsSummary}`,
    
    cost_intelligence: `Based on these AI cost metrics and projections, provide one recommendation for cost optimization:\n\n${metricsSummary}`,
  };

  return prompts[sectionName] || `Analyze these metrics and provide one key insight:\n\n${metricsSummary}`;
}

/**
 * Clear expired insights from cache
 * Run periodically to prevent memory leaks
 */
export function clearExpiredInsights() {
  const now = new Date();
  let cleared = 0;
  
  for (const [key, value] of Array.from(insightCache.entries())) {
    if (value.expiresAt <= now) {
      insightCache.delete(key);
      cleared++;
    }
  }
  
  if (cleared > 0) {
    console.log(`[InsightsEngine] Cleared ${cleared} expired insights`);
  }
}

setInterval(clearExpiredInsights, 60 * 60 * 1000);
