/**
 * Normalizes room names to canonical form for consistent lookups
 * 
 * Examples:
 * - "Living Room" → "living_room"
 * - "Kitchen/Dinning" → "kitchen_dining"
 * - "Downstairs WC" → "toilet"
 * - "Bedroom 1" → "bedroom_1"
 */
export function normalizeToCanonicalRoomName(roomName: string): string {
  if (!roomName) return '';

  let canonical = roomName
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[\/\\]/g, ' ')
    .replace(/[,\(\)\.]/g, '')
    .replace(/\s+/g, '_');

  const mappings: Record<string, string> = {
    'living_room': 'living_room',
    'sitting_room': 'living_room',
    'lounge': 'living_room',
    
    'kitchen_dinning': 'kitchen_dining',
    'kitchen_dining': 'kitchen_dining',
    'kitchen_and_dining': 'kitchen_dining',
    'kitchen': 'kitchen',
    'dining_room': 'dining_room',
    'dinning_room': 'dining_room',
    
    'wc': 'toilet',
    'toilet': 'toilet',
    'downstairs_wc': 'toilet',
    'downstairs_toilet': 'toilet',
    'cloakroom': 'toilet',
    'powder_room': 'toilet',
    
    'bathroom': 'bathroom',
    'bath': 'bathroom',
    
    'en_suite': 'ensuite',
    'ensuite': 'ensuite',
    'en_suite_bathroom': 'ensuite',
    
    'master_bedroom': 'master_bedroom',
    'bedroom_1': 'bedroom_1',
    'bedroom_2': 'bedroom_2',
    'bedroom_3': 'bedroom_3',
    'bedroom_4': 'bedroom_4',
    
    'hall': 'hallway',
    'hallway': 'hallway',
    'entrance_hall': 'hallway',
    
    'landing': 'landing',
    
    'utility': 'utility',
    'utility_room': 'utility',
    
    'study': 'study',
    'office': 'study',
    'home_office': 'study',
    
    'garage': 'garage',
    
    'storage': 'storage',
    'store': 'storage',
    'hot_press': 'storage',
  };

  return mappings[canonical] || canonical;
}

/**
 * Extracts canonical room name from a user question
 * 
 * Examples:
 * - "what size is my living room?" → "living_room"
 * - "kitchen dimensions" → "kitchen"
 * - "how big is the downstairs toilet" → "toilet"
 */
export function extractCanonicalRoomFromQuestion(question: string): string | null {
  if (!question) return null;

  const lower = question.toLowerCase();

  const roomPatterns = [
    'living room',
    'sitting room',
    'lounge',
    'kitchen/dinning',
    'kitchen/dining',
    'kitchen & dining',
    'kitchen and dining',
    'kitchen',
    'dining room',
    'wc',
    'toilet',
    'downstairs wc',
    'downstairs toilet',
    'cloakroom',
    'bathroom',
    'en suite',
    'ensuite',
    'master bedroom',
    'bedroom 1',
    'bedroom 2',
    'bedroom 3',
    'bedroom 4',
    'hall',
    'hallway',
    'entrance hall',
    'landing',
    'utility',
    'utility room',
    'study',
    'office',
    'garage',
    'storage',
    'hot press',
  ];

  for (const pattern of roomPatterns) {
    if (lower.includes(pattern)) {
      return normalizeToCanonicalRoomName(pattern);
    }
  }

  return null;
}
