import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const COMMON_TOPICS: Record<string, string[]> = {
  'living_room_size': ['living room', 'lounge', 'sitting room', 'size', 'dimensions', 'area', 'square', 'how big'],
  'kitchen_size': ['kitchen', 'size', 'dimensions', 'area', 'square', 'how big'],
  'bedroom_size': ['bedroom', 'master bedroom', 'size', 'dimensions', 'area', 'square', 'how big'],
  'bathroom_size': ['bathroom', 'ensuite', 'toilet', 'size', 'dimensions', 'area'],
  'garden_size': ['garden', 'back garden', 'front garden', 'outdoor', 'size', 'dimensions', 'area'],
  'heating_system': ['heating', 'heat pump', 'boiler', 'radiator', 'thermostat', 'temperature', 'warm', 'hot water'],
  'waste_collection': ['bin', 'bins', 'waste', 'rubbish', 'recycling', 'collection', 'garbage', 'refuse'],
  'parking': ['parking', 'car park', 'driveway', 'garage', 'car space'],
  'broadband_internet': ['broadband', 'internet', 'wifi', 'wi-fi', 'fibre', 'connection'],
  'electric_car_charging': ['ev', 'charger', 'electric car', 'charging', 'epod', 'ohme'],
  'appliances': ['appliances', 'oven', 'hob', 'dishwasher', 'washing machine', 'dryer', 'fridge'],
  'kitchen_cabinets': ['kitchen', 'cabinets', 'cupboards', 'drawers', 'wardrobe', 'storage'],
  'flooring': ['flooring', 'floor', 'tiles', 'carpet', 'laminate', 'wood floor'],
  'windows_doors': ['window', 'windows', 'door', 'doors', 'glass', 'locks', 'keys'],
  'paint_decoration': ['paint', 'colour', 'color', 'walls', 'decoration', 'finish'],
  'moving_in': ['moving', 'move in', 'completion', 'handover', 'keys', 'snag'],
  'warranty_guarantee': ['warranty', 'guarantee', 'defect', 'repair', 'maintenance'],
  'floor_plan': ['floor plan', 'layout', 'blueprint', 'drawing', 'plans'],
  'property_management': ['management', 'service charge', 'fees', 'maintenance charge'],
  'contact_developer': ['contact', 'developer', 'builder', 'phone', 'email', 'reach', 'speak to'],
};

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[?!.,;:'"]/g, '').trim();
}

function tryLocalTopicMatch(question: string): string | null {
  const normalized = normalizeText(question);
  
  for (const [topic, keywords] of Object.entries(COMMON_TOPICS)) {
    let matchCount = 0;
    for (const keyword of keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }
    if (matchCount >= 2) {
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
