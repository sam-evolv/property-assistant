import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const EXACT_MATCH_TOPICS: Record<string, string[]> = {
  'heat_pump': ['heat pump', 'heatpump', 'daikin', 'altherma'],
  'solar_panels': ['solar', 'pv panel', 'photovoltaic'],
  'aquabox': ['aquabox', 'aqua box', 'water tank', 'rainwater'],
  'waste_collection': ['waste', 'bin', 'bins', 'rubbish', 'recycling', 'garbage', 'refuse'],
  'broadband_internet': ['broadband', 'internet', 'wifi', 'wi-fi', 'fibre', 'siro'],
  'electric_car_charging': ['ev charger', 'electric car', 'epod', 'ohme', 'car charging'],
  'landscaping': ['landscaping', 'garden', 'planting', 'trees', 'shrubs', 'lawn'],
  'local_schools': ['school', 'schools', 'education', 'kids', 'children'],
  'local_amenities': ['amenities', 'shops', 'supermarket', 'transport', 'bus', 'train'],
  'planning_report': ['planning', 'planning report', 'permission'],
  'warranty_guarantee': ['warranty', 'guarantee', 'defect', 'snag', 'snagging'],
};

const ROOM_SIZE_PATTERNS: Record<string, RegExp[]> = {
  'living_room_size': [/living\s*room/, /lounge/, /sitting\s*room/],
  'kitchen_size': [/kitchen/, /dining/],
  'bedroom_size': [/bedroom/, /master\s*bedroom/],
  'bathroom_size': [/bathroom/, /ensuite/, /en-suite/, /toilet/, /wc/],
  'garden_size': [/garden/, /back\s*garden/, /front\s*garden/],
  'floor_area': [/floor\s*area/, /total\s*area/, /square\s*(feet|meters|metres|footage)/],
};

const SIZE_KEYWORDS = ['size', 'dimensions', 'how big', 'how large', 'square', 'area', 'sqm', 'sq ft', 'measure'];

const TOPIC_PATTERNS: Record<string, RegExp> = {
  'bedroom_count': /how\s*many\s*bedroom/i,
  'bathroom_count': /how\s*many\s*bathroom/i,
  'house_details': /basic\s*detail|about\s*my\s*house|property\s*detail/i,
  'kitchen_options': /kitchen\s*option|kitchen\s*upgrade|kitchen\s*choice/i,
  'flooring': /floor|flooring|tiles|carpet|laminate/i,
  'windows_doors': /window|door|glass|locks|keys/i,
  'paint_decoration': /paint|colour|color|walls|decoration/i,
  'moving_in': /move\s*in|moving|completion|handover/i,
  'contact_developer': /contact|developer|builder|phone|email|reach|speak\s*to/i,
  'parking': /parking|car\s*park|driveway|garage/i,
  'appliances': /appliance|oven|hob|dishwasher|washing\s*machine|dryer|fridge/i,
};

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[?!.,;:'"]/g, '').trim();
}

function tryLocalTopicMatch(question: string): string | null {
  if (!question || question.trim().length === 0) {
    return null;
  }
  
  const normalized = normalizeText(question);
  
  for (const [topic, keywords] of Object.entries(EXACT_MATCH_TOPICS)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        return topic;
      }
    }
  }
  
  const hasSizeKeyword = SIZE_KEYWORDS.some(kw => normalized.includes(kw));
  if (hasSizeKeyword) {
    for (const [topic, patterns] of Object.entries(ROOM_SIZE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(normalized)) {
          return topic;
        }
      }
    }
  }
  
  for (const [topic, pattern] of Object.entries(TOPIC_PATTERNS)) {
    if (pattern.test(normalized)) {
      return topic;
    }
  }
  
  return null;
}

export async function extractQuestionTopic(question: string): Promise<string> {
  const localMatch = tryLocalTopicMatch(question);
  if (localMatch) {
    console.log('[TopicExtractor] Local match:', localMatch);
    return localMatch;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a question classifier for a property/real estate assistant. 
Given a user question, extract a short canonical topic identifier (2-4 words, snake_case format).

Examples:
- "What size is my living room?" → living_room_size
- "how big is the kitchen" → kitchen_size  
- "Can you tell me the dimensions of the master bedroom?" → bedroom_size
- "When is bin collection day?" → waste_collection
- "How does the heating work?" → heating_system
- "What broadband provider do I use?" → broadband_internet
- "How do I charge my electric car?" → electric_car_charging
- "What appliances are included?" → appliances_included
- "Who do I contact for repairs?" → repairs_contact

Return ONLY the topic identifier in snake_case, nothing else.`,
        },
        {
          role: 'user',
          content: question,
        },
      ],
      temperature: 0,
      max_tokens: 20,
    });

    const topic = response.choices[0]?.message?.content?.trim().toLowerCase().replace(/\s+/g, '_') || 'general_inquiry';
    console.log('[TopicExtractor] AI extracted topic:', topic);
    return topic;
  } catch (error) {
    console.error('[TopicExtractor] Error:', error);
    return 'general_inquiry';
  }
}
