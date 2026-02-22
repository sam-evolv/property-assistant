import OpenAI from 'openai';

export type QueryLayer = 'layer1' | 'layer2' | 'layer3' | 'layer4' | 'hybrid' | 'briefing';

export interface RouterResult {
  layers: QueryLayer[];
  functions?: string[];
  ragQuery?: string;
  ragFilter?: {
    is_regulatory?: boolean;
    discipline?: string;
  };
  isRegulatory: boolean;
}

const CLASSIFICATION_PROMPT = `You are a query router for a property developer intelligence system. Classify the developer's question into the appropriate query layer(s).

LAYERS:
- layer1: Live data queries (unit counts, registration rates, pipeline status, revenue, handovers, messages, documents, snags, kitchen selections). Use when the question asks about numbers, stats, or current data.
- layer2: Scheme-specific document search (uploaded documents for this development — specs, plans, fire certs, drawings). Use when asking about specific scheme documents or specifications.
- layer3: Unit-specific knowledge (individual unit details, purchaser info, specs). Use when asking about a specific unit.
- layer4: Irish building regulations and compliance (Part B fire, Part F ventilation, Part L energy, Part M access, BCAR, HomeBond, GDPR). Use when asking about regulations, building codes, compliance requirements.
- briefing: Daily briefing summary. Use when asking for "today's briefing", "morning update", "what do I need to know today".

AVAILABLE LAYER 1 FUNCTIONS:
- getRegistrationRate: homeowner registration stats
- getHandoverPipeline: upcoming handovers by month
- getHomeownerActivity: message volumes and top topics
- getStagePaymentStatus: units at each pipeline stage
- getProjectedRevenue: revenue projections by month
- getDocumentCoverage: document processing stats
- getMostAskedQuestions: top question topics
- getOutstandingSnags: maintenance/snag requests
- getKitchenSelections: kitchen selection progress
- getSchemeSummary: overall scheme overview
- getCommunicationsLog: noticeboard posts, announcements, communications
- getUnitTypeBreakdown: unit types and bedroom count breakdown
- getSEAIGrants: SEAI grant information (solar PV, EV charger, insulation, heat pump)

Return JSON only. Example:
{"layers":["layer1"],"functions":["getRegistrationRate"],"ragQuery":null,"isRegulatory":false}
{"layers":["layer4"],"functions":null,"ragQuery":"Part F ventilation requirements residential","isRegulatory":true}
{"layers":["layer1","layer2"],"functions":["getDocumentCoverage"],"ragQuery":"fire safety certificates","isRegulatory":false}
{"layers":["briefing"],"functions":null,"ragQuery":null,"isRegulatory":false}`;

export async function routeQuery(
  question: string,
  context: any
): Promise<RouterResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: CLASSIFICATION_PROMPT },
        {
          role: 'user',
          content: `Context: Scheme "${context.schemeName || 'All Schemes'}", ${context.totalUnits || 0} units.\n\nQuestion: ${question}`,
        },
      ],
      temperature: 0,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return fallbackRoute(question);
    }

    const parsed = JSON.parse(content);
    return {
      layers: parsed.layers || ['layer1'],
      functions: parsed.functions || undefined,
      ragQuery: parsed.ragQuery || undefined,
      ragFilter: parsed.ragFilter || undefined,
      isRegulatory: parsed.isRegulatory || false,
    };
  } catch (error) {
    console.error('[SchemeIntel Router] Classification failed, using fallback:', error);
    return fallbackRoute(question);
  }
}

function fallbackRoute(question: string): RouterResult {
  const lower = question.toLowerCase();

  // Briefing
  if (lower.includes('briefing') || lower.includes('morning update') || lower.includes('what do i need to know')) {
    return { layers: ['briefing'], isRegulatory: false };
  }

  // Regulatory keywords
  const regulatoryKeywords = [
    'part b', 'part f', 'part l', 'part m', 'bcar', 'homebond',
    'building regulation', 'fire safety', 'ventilation', 'gdpr',
    'compliance requirement', 'building code', 'defects liability',
  ];
  if (regulatoryKeywords.some((kw) => lower.includes(kw))) {
    return {
      layers: ['layer4'],
      ragQuery: question,
      isRegulatory: true,
    };
  }

  // Data keywords
  const dataKeywords: Record<string, string> = {
    'registration': 'getRegistrationRate',
    'registered': 'getRegistrationRate',
    'handover': 'getHandoverPipeline',
    'revenue': 'getProjectedRevenue',
    'pipeline': 'getStagePaymentStatus',
    'stage': 'getStagePaymentStatus',
    'payment': 'getStagePaymentStatus',
    'document': 'getDocumentCoverage',
    'homeowner': 'getHomeownerActivity',
    'message': 'getHomeownerActivity',
    'question': 'getMostAskedQuestions',
    'asking': 'getMostAskedQuestions',
    'snag': 'getOutstandingSnags',
    'maintenance': 'getOutstandingSnags',
    'kitchen': 'getKitchenSelections',
    'summary': 'getSchemeSummary',
    'overview': 'getSchemeSummary',
    'noticeboard': 'getCommunicationsLog',
    'communication': 'getCommunicationsLog',
    'notice': 'getCommunicationsLog',
    'announcement': 'getCommunicationsLog',
    'unit type': 'getUnitTypeBreakdown',
    'bedroom': 'getUnitTypeBreakdown',
    'layout': 'getUnitTypeBreakdown',
    'mix': 'getUnitTypeBreakdown',
    'grant': 'getSEAIGrants',
    'seai': 'getSEAIGrants',
    'solar': 'getSEAIGrants',
    'ev charger': 'getSEAIGrants',
    'insulation grant': 'getSEAIGrants',
    'heat pump grant': 'getSEAIGrants',
    'energy grant': 'getSEAIGrants',
    'retrofit': 'getSEAIGrants',
  };

  for (const [keyword, fn] of Object.entries(dataKeywords)) {
    if (lower.includes(keyword)) {
      return {
        layers: ['layer1'],
        functions: [fn],
        isRegulatory: false,
      };
    }
  }

  // Default: hybrid
  return {
    layers: ['layer1', 'layer2'],
    functions: ['getSchemeSummary'],
    ragQuery: question,
    isRegulatory: false,
  };
}
