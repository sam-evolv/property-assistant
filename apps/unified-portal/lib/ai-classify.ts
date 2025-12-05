/**
 * AI Document Classification Helper
 * 
 * Uses OpenAI to classify documents by discipline and extract house type codes.
 * Integrates with the Smart Archive feature for automatic document organization.
 */

import OpenAI from 'openai';
import type { DisciplineType } from './archive';

const openai = new OpenAI();

export interface ClassificationResult {
  discipline: DisciplineType;
  confidence: number;
  houseTypeCodes: string[];
  suggestedTags: string[];
  reasoning?: string;
}

const DISCIPLINE_KEYWORDS: Record<DisciplineType, string[]> = {
  architectural: [
    'elevation', 'section', 'plan', 'ga', 'general arrangement', 
    'floor plan', 'layout', 'facade', 'roof plan', 'ceiling plan',
    'detail', 'door schedule', 'window schedule', 'finish schedule'
  ],
  structural: [
    'structural', 'beam', 'column', 'rebar', 'reinforcement', 
    'foundation', 'footing', 'slab', 'steel', 'concrete',
    'load bearing', 'shear wall', 'truss', 'connection detail'
  ],
  mechanical: [
    'hvac', 'duct', 'vent', 'ventilation', 'heating', 'cooling',
    'air conditioning', 'mechanical', 'diffuser', 'ahu', 'vrf',
    'boiler', 'chiller', 'heat pump', 'energy recovery'
  ],
  electrical: [
    'electrical', 'wiring', 'circuit', 'load', 'containment',
    'lighting', 'power', 'socket', 'distribution board', 'db',
    'cable tray', 'conduit', 'switch', 'panel', 'transformer'
  ],
  plumbing: [
    'plumbing', 'water supply', 'drainage', 'sanitary', 'pipe',
    'waste', 'sewage', 'hot water', 'cold water', 'sprinkler',
    'fire protection', 'toilet', 'bathroom', 'kitchen plumbing'
  ],
  civil: [
    'civil', 'site work', 'road', 'paving', 'earthwork',
    'grading', 'stormwater', 'drainage', 'utility', 'infrastructure',
    'survey', 'topography', 'boundary', 'site plan'
  ],
  landscape: [
    'landscape', 'planting', 'hardscape', 'garden', 'softscape',
    'irrigation', 'paving', 'fence', 'outdoor', 'amenity',
    'playground', 'lawn', 'tree', 'shrub', 'vegetation'
  ],
  other: []
};

const HOUSE_TYPE_PATTERN = /\b(BD|BS|BT|BZ)\d{2}\b/gi;

export function classifyByKeywords(text: string): { discipline: DisciplineType; score: number } {
  const lowerText = text.toLowerCase();
  const scores: Record<DisciplineType, number> = {
    architectural: 0,
    structural: 0,
    mechanical: 0,
    electrical: 0,
    plumbing: 0,
    civil: 0,
    landscape: 0,
    other: 0
  };

  for (const [discipline, keywords] of Object.entries(DISCIPLINE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        scores[discipline as DisciplineType] += 1;
      }
    }
  }

  let maxDiscipline: DisciplineType = 'other';
  let maxScore = 0;

  for (const [discipline, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      maxDiscipline = discipline as DisciplineType;
    }
  }

  return { discipline: maxDiscipline, score: maxScore };
}

export function extractHouseTypeCodes(text: string): string[] {
  const matches = text.toUpperCase().match(HOUSE_TYPE_PATTERN);
  if (!matches) return [];
  
  const uniqueCodes = [...new Set(matches)];
  return uniqueCodes;
}

export async function classifyDocumentWithAI(
  fileName: string,
  textContent?: string
): Promise<ClassificationResult> {
  const combinedText = `${fileName} ${textContent || ''}`;
  
  const keywordResult = classifyByKeywords(combinedText);
  const houseTypeCodes = extractHouseTypeCodes(combinedText);

  if (keywordResult.score >= 3) {
    return {
      discipline: keywordResult.discipline,
      confidence: Math.min(0.95, 0.6 + keywordResult.score * 0.1),
      houseTypeCodes,
      suggestedTags: [],
      reasoning: `Classified by keyword matching (${keywordResult.score} matches)`
    };
  }

  try {
    const prompt = `You are a construction document classifier. Analyze this document and classify it.

Document filename: ${fileName}
${textContent ? `Document content (first 2000 chars): ${textContent.slice(0, 2000)}` : 'No text content available.'}

Classify this document into ONE of these disciplines:
- architectural: Floor plans, elevations, sections, architectural details
- structural: Structural drawings, calculations, foundations, beams, columns
- mechanical: HVAC systems, ventilation, heating, cooling
- electrical: Electrical layouts, lighting, power, circuits
- plumbing: Water supply, drainage, sanitary systems
- civil: Site works, roads, drainage, earthworks
- landscape: Landscaping, planting, hardscape
- other: Does not fit any category

Respond in JSON format:
{
  "discipline": "one of the above categories",
  "confidence": 0.0 to 1.0,
  "suggestedTags": ["tag1", "tag2"],
  "reasoning": "Brief explanation"
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 200,
      temperature: 0.3,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(responseText);
    const validDisciplines: DisciplineType[] = [
      'architectural', 'structural', 'mechanical', 'electrical',
      'plumbing', 'civil', 'landscape', 'other'
    ];

    const discipline = validDisciplines.includes(parsed.discipline) 
      ? parsed.discipline as DisciplineType 
      : 'other';

    return {
      discipline,
      confidence: Math.min(1.0, Math.max(0.0, parsed.confidence || 0.5)),
      houseTypeCodes,
      suggestedTags: Array.isArray(parsed.suggestedTags) ? parsed.suggestedTags : [],
      reasoning: parsed.reasoning || 'AI classification'
    };
  } catch (error) {
    console.error('[AI Classify] Error:', error);
    
    return {
      discipline: keywordResult.discipline,
      confidence: Math.max(0.3, keywordResult.score * 0.15),
      houseTypeCodes,
      suggestedTags: [],
      reasoning: 'Fallback to keyword classification due to AI error'
    };
  }
}

export async function classifyMultipleDocuments(
  documents: Array<{ fileName: string; textContent?: string }>
): Promise<ClassificationResult[]> {
  return Promise.all(
    documents.map(doc => classifyDocumentWithAI(doc.fileName, doc.textContent))
  );
}
