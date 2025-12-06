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
    'detail', 'door schedule', 'window schedule', 'finish schedule',
    'house type', 'ground floor', 'first floor', 'second floor',
    'furnishings', 'furniture', 'room layout', 'bedroom', 'living room',
    '-dr-a-', 'arch', 'archit'
  ],
  structural: [
    'structural', 'beam', 'column', 'rebar', 'reinforcement', 
    'foundation', 'footing', 'slab', 'steel', 'concrete',
    'load bearing', 'shear wall', 'truss', 'connection detail',
    '-dr-s-', 'str', 'struct', 'raft', 'castleforms'
  ],
  mechanical: [
    'hvac', 'duct', 'vent', 'ventilation', 'heating', 'cooling',
    'air conditioning', 'mechanical', 'diffuser', 'ahu', 'vrf',
    'boiler', 'chiller', 'heat pump', 'energy recovery', 'altherma',
    'daikin', 'm&e', 'mech', '-dr-m-', 'thermtek', 'thermal'
  ],
  electrical: [
    'electrical', 'wiring', 'circuit', 'load', 'containment',
    'lighting', 'power', 'socket', 'distribution board', 'db',
    'cable tray', 'conduit', 'switch', 'panel', 'transformer',
    '-dr-e-', 'elec', 'isolator', 'solar', 'pv', 'module', 
    'epod', 'charger', 'ohme', 'ev', 'esb', 'siro'
  ],
  plumbing: [
    'plumbing', 'water supply', 'drainage', 'sanitary', 'pipe',
    'waste', 'sewage', 'hot water', 'cold water', 'sprinkler',
    'fire protection', 'toilet', 'bathroom', 'kitchen plumbing',
    '-dr-p-', 'plumb', 'soil', 'rainwater', 'instantor', 'copper',
    'shower', 'trv', 'radiator', 'vessel', 'tank', 'flamco'
  ],
  civil: [
    'civil', 'site work', 'road', 'paving', 'earthwork',
    'grading', 'stormwater', 'drainage', 'utility', 'infrastructure',
    'survey', 'topography', 'boundary', 'site plan',
    '-dr-c-', 'transport', 'parking'
  ],
  landscape: [
    'landscape', 'planting', 'hardscape', 'garden', 'softscape',
    'irrigation', 'paving', 'fence', 'outdoor', 'amenity',
    'playground', 'lawn', 'tree', 'shrub', 'vegetation',
    '-dr-l-', 'lansdcape', 'tobermore'
  ],
  other: []
};

const DOCUMENT_TYPE_PATTERNS: { pattern: RegExp; discipline: DisciplineType }[] = [
  { pattern: /-dr-a-/i, discipline: 'architectural' },
  { pattern: /-dr-s-/i, discipline: 'structural' },
  { pattern: /-dr-m-/i, discipline: 'mechanical' },
  { pattern: /-dr-e-/i, discipline: 'electrical' },
  { pattern: /-dr-p-/i, discipline: 'plumbing' },
  { pattern: /-dr-c-/i, discipline: 'civil' },
  { pattern: /-dr-l-/i, discipline: 'landscape' },
  { pattern: /\belevation/i, discipline: 'architectural' },
  { pattern: /\bfloor\s*(plan|layout)/i, discipline: 'architectural' },
  { pattern: /\b(ground|first|second)\s*floor/i, discipline: 'architectural' },
  { pattern: /house\s*type/i, discipline: 'architectural' },
  { pattern: /furnishing/i, discipline: 'architectural' },
  { pattern: /\b(hvac|daikin|altherma|heat\s*pump)\b/i, discipline: 'mechanical' },
  { pattern: /\bventilation\b/i, discipline: 'mechanical' },
  { pattern: /\b(radiator|trv|thermostat)\b/i, discipline: 'plumbing' },
  { pattern: /\b(drainage|rainwater|soil|waste)\b/i, discipline: 'plumbing' },
  { pattern: /\b(sanitary|shower|bathroom)\b/i, discipline: 'plumbing' },
  { pattern: /\b(ohme|ev\s*charger|epod|solar|pv\s*panel)\b/i, discipline: 'electrical' },
  { pattern: /\b(fire\s*(panel|stopping|seal|door))/i, discipline: 'other' },
  { pattern: /\b(waterproof|tanking|membrane)\b/i, discipline: 'other' },
  { pattern: /\b(insulation|thermal)\b/i, discipline: 'other' },
  { pattern: /\b(certificate|declaration|dop|datasheet|specification|spec)\b/i, discipline: 'other' },
];

const HOUSE_TYPE_PATTERN = /\b(BD|BS|BT|BZ)\d{2}\b/gi;

export function classifyByPatterns(text: string): { discipline: DisciplineType; matched: boolean } {
  for (const { pattern, discipline } of DOCUMENT_TYPE_PATTERNS) {
    if (pattern.test(text)) {
      return { discipline, matched: true };
    }
  }
  return { discipline: 'other', matched: false };
}

export function classifyByKeywords(text: string): { discipline: DisciplineType; score: number } {
  const lowerText = text.toLowerCase();
  
  const patternResult = classifyByPatterns(lowerText);
  if (patternResult.matched && patternResult.discipline !== 'other') {
    return { discipline: patternResult.discipline, score: 5 };
  }
  
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
    if (score > maxScore && discipline !== 'other') {
      maxScore = score;
      maxDiscipline = discipline as DisciplineType;
    }
  }

  if (patternResult.matched && patternResult.discipline === 'other' && maxScore === 0) {
    return { discipline: 'other', score: 1 };
  }

  return { discipline: maxDiscipline, score: maxScore };
}

export function extractHouseTypeCodes(text: string): string[] {
  const matches = text.toUpperCase().match(HOUSE_TYPE_PATTERN);
  if (!matches) return [];
  
  const uniqueCodes = Array.from(new Set(matches));
  return uniqueCodes;
}

export async function classifyDocumentWithAI(
  fileName: string,
  textContent?: string
): Promise<ClassificationResult> {
  const combinedText = `${fileName} ${textContent || ''}`;
  
  const keywordResult = classifyByKeywords(combinedText);
  const houseTypeCodes = extractHouseTypeCodes(combinedText);

  if (keywordResult.score >= 2) {
    return {
      discipline: keywordResult.discipline,
      confidence: Math.min(0.95, 0.5 + keywordResult.score * 0.12),
      houseTypeCodes,
      suggestedTags: [],
      reasoning: `Classified by keyword/pattern matching (score: ${keywordResult.score})`
    };
  }

  try {
    const prompt = `You are an expert construction document classifier for residential developments in Ireland/UK. 

IMPORTANT: You MUST classify each document into ONE specific discipline. Only use "other" as an absolute last resort for documents that truly don't fit ANY discipline (like general product brochures or certifications).

Document filename: ${fileName}
${textContent ? `Document content (first 2000 chars): ${textContent.slice(0, 2000)}` : 'No text content available.'}

Disciplines (choose the BEST match):
- architectural: House type drawings, floor plans, elevations, sections, room layouts, furniture plans, architectural details, GA drawings. Look for codes like BD01, BS02, BT03 (these are house types)
- structural: Foundations, raft slabs, reinforcement, steel, concrete, beams, columns
- mechanical: HVAC, heating systems, heat pumps (Daikin, Altherma), ventilation, air conditioning
- electrical: Electrical layouts, lighting, EV chargers (Ohme), solar panels, distribution boards, home automation
- plumbing: Water supply, drainage, sanitary ware, radiators, pipes, showers, bathrooms, rainwater systems
- civil: Site works, roads, parking, transport infrastructure
- landscape: Gardens, planting, fencing, outdoor areas
- other: ONLY for product datasheets, certificates, and documents that genuinely don't relate to any discipline

Drawing reference codes hint: "-DR-A-" = Architectural, "-DR-S-" = Structural, "-DR-M-" = Mechanical, "-DR-E-" = Electrical, "-DR-P-" = Plumbing

Respond ONLY with valid JSON:
{
  "discipline": "architectural|structural|mechanical|electrical|plumbing|civil|landscape|other",
  "confidence": 0.6 to 1.0,
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
