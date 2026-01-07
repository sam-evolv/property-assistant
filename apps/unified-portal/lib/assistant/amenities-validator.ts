/**
 * Amenities Response Validator
 * 
 * Validates AI responses to detect and block ungrounded POI claims:
 * - Specific venue/store names that weren't sourced from Google Places
 * - Opening hours unless from Places open_now field
 * - Travel time claims unless from Distance Matrix API
 */

export interface ValidationResult {
  isValid: boolean;
  violations: string[];
  cleanedResponse?: string;
}

const SUPERMARKET_CHAINS = [
  'supervalu', 'super valu', 'dunnes', "dunnes stores", 'tesco', 'aldi', 'lidl',
  'spar', 'centra', 'eurospar', 'mace', 'londis', 'costcutter', 'gala', 'daybreak',
  'fresh', 'freshway', 'supervalu', 'marks & spencer', 'm&s', 'ikea', 'costco',
  'sainsbury', 'asda', 'morrisons', 'waitrose', 'co-op', 'booths', 'budgens',
];

const PHARMACY_CHAINS = [
  'boots', 'lloyds', "lloyd's", 'superdrug', 'hickeys', 'sam mccauley', 'mccauley',
  'totalhealth', 'allcare', 'cara', 'life pharmacy', 'haven pharmacy', 'healthplus',
];

const RESTAURANT_CHAINS = [
  'mcdonalds', "mcdonald's", 'burger king', 'kfc', 'subway', 'costa', 'starbucks',
  'insomnia', 'caffe nero', "pret a manger", 'nandos', "nando's", 'five guys',
  'wagamama', 'pizza hut', 'dominos', "domino's", 'papa johns', 'supermacs',
  'eddie rockets', 'abrakebabra', 'apache pizza', 'four star pizza',
];

const ALL_VENUE_NAMES = [...SUPERMARKET_CHAINS, ...PHARMACY_CHAINS, ...RESTAURANT_CHAINS];

const OPENING_HOURS_PATTERNS = [
  /\b\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)\s*(?:to|-|–|until)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)\b/i,
  /\bopen(?:s|ing)?\s+(?:at|from)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i,
  /\bclose(?:s|d)?\s+(?:at)?\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i,
  /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*(?:to|-)\s*(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\bopen\s+\d+\s*(?:hours|hrs)\b/i,
  /\b24\s*(?:hours|hrs|\/7)\b/i,
  /\bopen\s+(?:daily|everyday|every day|all day)\b/i,
];

const TRAVEL_TIME_PATTERNS = [
  /\b\d+(?:-\d+)?\s*(?:minute|min|mins)\s+(?:walk|drive|bus|train|cycle|ride)\b/i,
  /\b(?:walking|driving|cycling)\s+distance\s+(?:of\s+)?\d+/i,
  /\bjust\s+(?:a\s+)?(?:\d+|few|couple)\s*(?:minute|min)\s*(?:away|walk|drive)\b/i,
  /\bwithin\s+(?:a\s+)?\d+\s*(?:minute|min)\b/i,
  /\babout\s+\d+\s*(?:minute|min|mins)\s+(?:away|from)\b/i,
];

export function validateAmenityResponse(
  response: string,
  source: string,
  allowedVenueNames?: string[]
): ValidationResult {
  const violations: string[] = [];
  const responseLower = response.toLowerCase();
  
  if (source === 'google_places') {
    return { isValid: true, violations: [] };
  }
  
  for (const venueName of ALL_VENUE_NAMES) {
    if (responseLower.includes(venueName.toLowerCase())) {
      if (allowedVenueNames?.some(allowed => venueName.toLowerCase().includes(allowed.toLowerCase()))) {
        continue;
      }
      violations.push(`Ungrounded venue name: "${venueName}"`);
    }
  }
  
  for (const pattern of OPENING_HOURS_PATTERNS) {
    const match = response.match(pattern);
    if (match) {
      violations.push(`Ungrounded opening hours: "${match[0]}"`);
    }
  }
  
  for (const pattern of TRAVEL_TIME_PATTERNS) {
    const match = response.match(pattern);
    if (match) {
      violations.push(`Ungrounded travel time: "${match[0]}"`);
    }
  }
  
  return {
    isValid: violations.length === 0,
    violations,
  };
}

export function stripUngroundedClaims(response: string): string {
  let cleaned = response;
  
  for (const pattern of OPENING_HOURS_PATTERNS) {
    cleaned = cleaned.replace(pattern, '[opening hours may vary]');
  }
  
  for (const pattern of TRAVEL_TIME_PATTERNS) {
    cleaned = cleaned.replace(pattern, '[check distance on Google Maps]');
  }
  
  return cleaned;
}

export function getAmenityFallbackResponse(schemeAddress: string, category?: string): string {
  const categoryText = category ? ` ${category.replace(/_/g, ' ')}` : ' amenity';
  return `I couldn't retrieve nearby${categoryText} information right now. Please try again, or check Google Maps for ${schemeAddress}.`;
}

export const AMENITY_VALIDATION_RULES = {
  venueNames: ALL_VENUE_NAMES,
  openingHoursPatterns: OPENING_HOURS_PATTERNS,
  travelTimePatterns: TRAVEL_TIME_PATTERNS,
};
