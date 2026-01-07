import type { POIResult } from '../places/poi';

const COMMON_VENUE_CHAINS = [
  'costa', 'starbucks', 'insomnia', 'centra', 'spar', 'mace', 'londis', 'gala',
  'tesco', 'dunnes', 'lidl', 'aldi', 'supervalu', 'eurospar', 'dealz', 'penneys',
  'boots', 'lloyds', 'hickeys', 'mccabes', 'mcdonald', 'burger king', 'supermac',
  'apache', 'applegreen', 'circle k', 'maxol', 'topaz'
];

const VENUE_LOCATION_PATTERN = /\b(?:in|at|on|near|beside|opposite)\s+([A-Z][A-Za-z0-9'\s-]+(?:Shopping\s*Centre|Center|Mall|Street|Road|Avenue|Park|Square|Village|Estate))\b/gi;
const TRAVEL_TIME_CLAIM_PATTERN = /\b(\d+)\s*(?:minute|min|mins|minutes?)?\s*(?:walk|drive|walking|driving)\b/gi;
const DISTANCE_CLAIM_PATTERN = /\b(\d+(?:\.\d+)?)\s*(?:km|m|metres?|meters?|kilometres?|kilometers?)\s*(?:away|from|to)?\b/gi;

export interface AmenityHallucinationCheck {
  hasHallucination: boolean;
  detectedIssues: string[];
  cleanedAnswer?: string;
}

export function detectAmenityHallucinations(
  answer: string,
  hasAmenityContext: boolean = false
): AmenityHallucinationCheck {
  const detectedIssues: string[] = [];
  const lowerAnswer = answer.toLowerCase();
  
  if (hasAmenityContext) {
    return { hasHallucination: false, detectedIssues: [] };
  }
  
  for (const chain of COMMON_VENUE_CHAINS) {
    if (lowerAnswer.includes(chain)) {
      detectedIssues.push(`venue_name:${chain}`);
    }
  }
  
  let match;
  while ((match = VENUE_LOCATION_PATTERN.exec(answer)) !== null) {
    detectedIssues.push(`location_claim:${match[1]}`);
  }
  
  TRAVEL_TIME_CLAIM_PATTERN.lastIndex = 0;
  while ((match = TRAVEL_TIME_CLAIM_PATTERN.exec(answer)) !== null) {
    detectedIssues.push(`travel_time:${match[0]}`);
  }
  
  DISTANCE_CLAIM_PATTERN.lastIndex = 0;
  while ((match = DISTANCE_CLAIM_PATTERN.exec(answer)) !== null) {
    detectedIssues.push(`distance:${match[0]}`);
  }
  
  const hasHallucination = detectedIssues.length > 0;
  
  let cleanedAnswer: string | undefined;
  if (hasHallucination) {
    cleanedAnswer = `I'd be happy to help with nearby amenities. If you ask about specific places like cafes, shops, or restaurants, I can search for what's actually in the area. For the most up-to-date local information, Google Maps is also a great resource.`;
  }
  
  return {
    hasHallucination,
    detectedIssues,
    cleanedAnswer,
  };
}

export interface ValidationContext {
  poiResults: POIResult[];
  hasDistanceMatrixData: boolean;
  category: string;
  schemeAddress?: string;
}

export interface ValidationResult {
  isValid: boolean;
  blockedClaimTypes: string[];
  rewrittenAnswer?: string;
  originalAnswer: string;
}

export interface ValidatedVenue {
  name: string;
  address: string;
  travelTime?: string;
  openStatus?: string;
}

const VENUE_NAME_PATTERN = /(?:^|\s|,)([A-Z][A-Za-z0-9'&\s-]{2,40})(?:\s+(?:in|on|at|near|by)\s+|,|\s*\()/g;
const TRAVEL_TIME_PATTERN = /(\d+)[\s-]*(minute|min|mins|minutes?)[\s-]*(walk|drive|walking|driving)/gi;
const LOCATION_CLAIM_PATTERN = /(?:in|at|near|by|on|opposite|beside|next to)\s+([A-Z][A-Za-z0-9'\s-]+(?:Shopping Centre|Center|Mall|Street|Road|Park|Square|Village|Estate))/gi;
const DISTANCE_PATTERN = /(\d+(?:\.\d+)?)\s*(km|m|metres?|meters?|kilometres?|kilometers?)/gi;

function normalizeVenueName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function venueNamesMatch(claimedName: string, actualName: string): boolean {
  const normalizedClaimed = normalizeVenueName(claimedName);
  const normalizedActual = normalizeVenueName(actualName);
  
  if (normalizedClaimed === normalizedActual) return true;
  if (normalizedActual.includes(normalizedClaimed)) return true;
  if (normalizedClaimed.includes(normalizedActual)) return true;
  
  const claimedWords = normalizedClaimed.split(/\s+/);
  const actualWords = normalizedActual.split(/\s+/);
  const matchingWords = claimedWords.filter(w => actualWords.includes(w));
  
  if (claimedWords.length >= 2 && matchingWords.length >= Math.ceil(claimedWords.length * 0.6)) {
    return true;
  }
  
  return false;
}

function extractClaimedVenueNames(answer: string): string[] {
  const claimedNames: string[] = [];
  
  const bulletPattern = /[-•]\s*([A-Z][A-Za-z0-9'&\s-]+?)(?:\s*,|\s*\(|\s*-|\s*–|\n|$)/g;
  let match;
  while ((match = bulletPattern.exec(answer)) !== null) {
    const name = match[1].trim();
    if (name.length >= 3 && name.length <= 50) {
      claimedNames.push(name);
    }
  }
  
  const genericPattern = /(?:like|such as|including|e\.g\.|for example)\s+([A-Z][A-Za-z0-9'&\s-]+?)(?:\s*,|\s*and|\s*or|\.|$)/gi;
  while ((match = genericPattern.exec(answer)) !== null) {
    const name = match[1].trim();
    if (name.length >= 3 && name.length <= 50) {
      claimedNames.push(name);
    }
  }
  
  return claimedNames;
}

function extractTravelTimeClaims(answer: string): { value: number; mode: string }[] {
  const claims: { value: number; mode: string }[] = [];
  
  let match;
  while ((match = TRAVEL_TIME_PATTERN.exec(answer)) !== null) {
    claims.push({
      value: parseInt(match[1], 10),
      mode: match[3].toLowerCase().includes('walk') ? 'walk' : 'drive',
    });
  }
  
  return claims;
}

function extractDistanceClaims(answer: string): number[] {
  const distances: number[] = [];
  
  let match;
  while ((match = DISTANCE_PATTERN.exec(answer)) !== null) {
    let value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    
    if (unit.startsWith('m') && !unit.startsWith('mi')) {
      value = value / 1000;
    }
    
    distances.push(value);
  }
  
  return distances;
}

function extractLocationClaims(answer: string): string[] {
  const claims: string[] = [];
  
  let match;
  while ((match = LOCATION_CLAIM_PATTERN.exec(answer)) !== null) {
    claims.push(match[1].trim());
  }
  
  return claims;
}

export function validateAmenityAnswer(
  answer: string,
  context: ValidationContext
): ValidationResult {
  const blockedClaimTypes: string[] = [];
  const { poiResults, hasDistanceMatrixData } = context;
  
  const actualVenueNames = poiResults.map(p => p.name);
  const actualAddresses = poiResults.map(p => p.address).filter(Boolean);
  
  const claimedNames = extractClaimedVenueNames(answer);
  for (const claimed of claimedNames) {
    const isGrounded = actualVenueNames.some(actual => venueNamesMatch(claimed, actual));
    if (!isGrounded) {
      blockedClaimTypes.push(`ungrounded_venue:${claimed}`);
    }
  }
  
  const travelClaims = extractTravelTimeClaims(answer);
  if (travelClaims.length > 0 && !hasDistanceMatrixData) {
    blockedClaimTypes.push('travel_time_without_distance_matrix');
  }
  
  const distanceClaims = extractDistanceClaims(answer);
  if (distanceClaims.length > 0) {
    const validDistances = poiResults.map(p => p.distance_km);
    for (const claimed of distanceClaims) {
      const isValid = validDistances.some(d => Math.abs(d - claimed) < 0.5);
      if (!isValid) {
        blockedClaimTypes.push(`ungrounded_distance:${claimed}km`);
      }
    }
  }
  
  const locationClaims = extractLocationClaims(answer);
  for (const claimed of locationClaims) {
    const isInAddress = actualAddresses.some(addr => 
      addr.toLowerCase().includes(claimed.toLowerCase())
    );
    if (!isInAddress) {
      blockedClaimTypes.push(`ungrounded_location:${claimed}`);
    }
  }
  
  const isValid = blockedClaimTypes.length === 0;
  
  return {
    isValid,
    blockedClaimTypes,
    originalAnswer: answer,
    rewrittenAnswer: isValid ? undefined : generateGroundedAnswer(context),
  };
}

function generateGroundedAnswer(context: ValidationContext): string {
  const { poiResults, category, hasDistanceMatrixData, schemeAddress } = context;
  
  if (poiResults.length === 0) {
    const categoryName = category.replace(/_/g, ' ');
    return `I couldn't find any ${categoryName} close by. You could try Google Maps for a wider search around ${schemeAddress || 'the area'}.`;
  }
  
  const categoryName = category.replace(/_/g, ' ');
  const intro = `Here are some ${categoryName} options nearby:`;
  
  const bullets = poiResults.slice(0, 5).map(poi => {
    let line = `- ${poi.name}`;
    
    if (poi.address) {
      line += `, ${poi.address}`;
    }
    
    const extras: string[] = [];
    
    if (hasDistanceMatrixData) {
      if (poi.drive_time_min) {
        extras.push(`approx. ${poi.drive_time_min} min drive`);
      } else if (poi.walk_time_min) {
        extras.push(`approx. ${poi.walk_time_min} min walk`);
      }
    }
    
    if (poi.open_now !== undefined) {
      extras.push(poi.open_now ? 'open now' : 'currently closed');
    }
    
    if (extras.length > 0) {
      line += ` (${extras.join(', ')})`;
    }
    
    return line;
  }).join('\n');
  
  const fetchedAt = new Date();
  const dateStr = fetchedAt.toLocaleDateString('en-IE', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
  const sourceHint = `\n\nBased on Google Places, last updated ${dateStr}.`;
  
  return `${intro}\n\n${bullets}${sourceHint}`;
}

export function hasDistanceMatrixData(poiResults: POIResult[]): boolean {
  return poiResults.some(p => p.walk_time_min !== undefined || p.drive_time_min !== undefined);
}

export function createValidationContext(
  poiResults: POIResult[],
  category: string,
  schemeAddress?: string
): ValidationContext {
  return {
    poiResults,
    hasDistanceMatrixData: hasDistanceMatrixData(poiResults),
    category,
    schemeAddress,
  };
}
