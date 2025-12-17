import OpenAI from 'openai';

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });
}

export type DrawingType = 
  | 'floor_plan'
  | 'elevation'
  | 'room_sizes'
  | 'site_plan'
  | 'section'
  | 'detail'
  | 'other';

export interface DrawingClassification {
  houseTypeCode: string | null;
  drawingType: DrawingType;
  drawingDescription: string;
  confidence: 'high' | 'medium' | 'low';
}

const HOUSE_TYPE_PATTERNS = [
  /\b([A-Z]{1,3}\d{1,3}[A-Z]?)\b/i,
  /house[_\s-]?type[_\s-]?([A-Z0-9]+)/i,
  /type[_\s-]?([A-Z]{1,2}\d{1,2})/i,
  /-([A-Z]{2}\d{2})-/i,
];

const DRAWING_TYPE_KEYWORDS: Record<DrawingType, string[]> = {
  floor_plan: ['floor plan', 'ground floor', 'first floor', 'second floor', 'layout', 'floorplan', 'floor level', 'plans'],
  elevation: ['elevation', 'elevations', 'front elevation', 'rear elevation', 'side elevation', 'external view'],
  room_sizes: ['room size', 'room sizes', 'dimensions', 'room dimensions', 'areas', 'measurements'],
  site_plan: ['site plan', 'site layout', 'location plan', 'block plan'],
  section: ['section', 'cross section', 'longitudinal section', 'building section'],
  detail: ['detail', 'construction detail', 'junction detail', 'eaves detail'],
  other: [],
};

function extractHouseTypeLocal(filename: string): string | null {
  const cleanFilename = filename.replace(/\.[^/.]+$/, '');
  
  for (const pattern of HOUSE_TYPE_PATTERNS) {
    const match = cleanFilename.match(pattern);
    if (match && match[1]) {
      const code = match[1].toUpperCase();
      if (code.length >= 2 && code.length <= 6 && /[A-Z]/.test(code) && /\d/.test(code)) {
        return code;
      }
    }
  }
  
  return null;
}

function classifyDrawingTypeLocal(filename: string, title?: string): DrawingType | null {
  const searchText = `${filename} ${title || ''}`.toLowerCase();
  
  for (const [type, keywords] of Object.entries(DRAWING_TYPE_KEYWORDS)) {
    if (type === 'other') continue;
    for (const keyword of keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        return type as DrawingType;
      }
    }
  }
  
  return null;
}

export async function classifyDrawing(
  filename: string,
  title?: string,
  extractedText?: string
): Promise<DrawingClassification> {
  const localHouseType = extractHouseTypeLocal(filename);
  const localDrawingType = classifyDrawingTypeLocal(filename, title);
  
  if (localHouseType && localDrawingType) {
    console.log('[DrawingClassifier] Local match:', { houseTypeCode: localHouseType, drawingType: localDrawingType });
    return {
      houseTypeCode: localHouseType,
      drawingType: localDrawingType,
      drawingDescription: generateDescription(localDrawingType, localHouseType),
      confidence: 'high',
    };
  }
  
  try {
    const contextText = extractedText 
      ? extractedText.substring(0, 2000) 
      : '';
    
    const response = await getOpenAIClient().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a construction drawing classifier. Given a filename and optional content from a PDF drawing, extract:

1. house_type_code: The house type identifier (e.g., BD01, A02, C3, TYPE-A). Look for patterns like "BD01", "A-02", "House Type BD01", etc. Return null if not found.

2. drawing_type: One of:
   - floor_plan: Floor plans showing room layouts
   - elevation: External views of the building
   - room_sizes: Documents showing room dimensions/measurements
   - site_plan: Site layout or location plans
   - section: Cross-section drawings
   - detail: Construction details
   - other: Unknown type

3. description: A brief description of what this drawing shows

Respond in JSON format:
{
  "house_type_code": "BD01" or null,
  "drawing_type": "floor_plan",
  "description": "Ground and first floor layout plans for house type BD01"
}`,
        },
        {
          role: 'user',
          content: `Filename: ${filename}
${title ? `Title: ${title}` : ''}
${contextText ? `Content preview: ${contextText}` : ''}`,
        },
      ],
      temperature: 0,
      max_tokens: 200,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      console.log('[DrawingClassifier] AI classification:', parsed);
      
      return {
        houseTypeCode: parsed.house_type_code || localHouseType,
        drawingType: parsed.drawing_type || 'other',
        drawingDescription: parsed.description || generateDescription(parsed.drawing_type, parsed.house_type_code),
        confidence: parsed.house_type_code ? 'high' : 'medium',
      };
    }
  } catch (error) {
    console.error('[DrawingClassifier] AI classification error:', error);
  }
  
  return {
    houseTypeCode: localHouseType,
    drawingType: localDrawingType || 'other',
    drawingDescription: generateDescription(localDrawingType || 'other', localHouseType),
    confidence: localHouseType ? 'medium' : 'low',
  };
}

function generateDescription(drawingType: DrawingType, houseTypeCode: string | null): string {
  const typeDescriptions: Record<DrawingType, string> = {
    floor_plan: 'Floor plan showing room layouts and dimensions',
    elevation: 'Elevation drawing showing external views of the building',
    room_sizes: 'Room sizes document with measurements for each room',
    site_plan: 'Site plan showing building location and surroundings',
    section: 'Section drawing showing building cross-section',
    detail: 'Construction detail drawing',
    other: 'Architectural drawing',
  };
  
  let description = typeDescriptions[drawingType];
  if (houseTypeCode) {
    description += ` for house type ${houseTypeCode}`;
  }
  
  return description;
}

export function getDrawingTypeForQuestion(questionTopic: string): DrawingType[] {
  // ONLY show drawings for dimension/size questions - NOT for general product questions
  const dimensionTopics = [
    'living_room_size', 'kitchen_size', 'bedroom_size', 'bathroom_size',
    'floor_area', 'room_sizes', 'room_dimensions', 'house_layout',
    'internal_floor_plans', 'floor_plans',
  ];
  
  // External appearance questions that benefit from elevation drawings
  const externalAppearanceTopics = [
    'house_exterior', 'external_appearance', 'external_elevations', 'elevations',
  ];
  
  if (dimensionTopics.includes(questionTopic)) {
    return ['room_sizes', 'floor_plan'];
  }
  
  if (externalAppearanceTopics.includes(questionTopic)) {
    return ['elevation'];
  }
  
  // For all other topics (materials, products, features), don't show drawings
  return [];
}
