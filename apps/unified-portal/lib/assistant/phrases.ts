/**
 * Phrase management for tone guardrails
 * - Banned phrases with natural replacements
 * - Intent-based intro variants (8+ per family)
 * - Consistent "local guide" voice
 */

export interface PhraseReplacement {
  pattern: RegExp;
  replacement: string;
}

export const BANNED_PHRASES: PhraseReplacement[] = [
  { pattern: /I couldn'?t determine/gi, replacement: "Just to make sure I point you to the right place" },
  { pattern: /I don'?t have that information to hand/gi, replacement: "I can't see that in your documents yet" },
  { pattern: /Please ask about a specific type/gi, replacement: "Are you looking for something specific" },
  { pattern: /I was unable to/gi, replacement: "I wasn't able to" },
  { pattern: /Unfortunately,?\s*I\s+(cannot|can'?t|am unable to)/gi, replacement: "I'm not able to" },
  { pattern: /I do not have access to/gi, replacement: "I don't have details on" },
  { pattern: /The system does not/gi, replacement: "I don't" },
  { pattern: /This information is not available/gi, replacement: "I don't have that to hand" },
  { pattern: /I apologize,?\s*but/gi, replacement: "Just to let you know" },
  { pattern: /I'm sorry,?\s*but\s+I\s+(cannot|can'?t)/gi, replacement: "I'm not able to" },
  { pattern: /Please note that/gi, replacement: "Just so you know" },
  { pattern: /It is important to note/gi, replacement: "Worth knowing" },
  { pattern: /For your safety/gi, replacement: "To stay safe" },
  { pattern: /It is recommended that you/gi, replacement: "I'd suggest" },
  { pattern: /You may wish to/gi, replacement: "You might want to" },
  { pattern: /I would suggest that you/gi, replacement: "I'd suggest" },
  { pattern: /Based on the available information/gi, replacement: "From what I can see" },
  { pattern: /According to the documentation/gi, replacement: "According to your documents" },
  { pattern: /The documentation indicates/gi, replacement: "Your documents show" },
  { pattern: /As per the reference materials/gi, replacement: "From your home information" },
  { pattern: /I regret to inform you/gi, replacement: "I should mention" },
  { pattern: /At this time/gi, replacement: "Right now" },
  { pattern: /At the present time/gi, replacement: "Right now" },
  { pattern: /In order to/gi, replacement: "To" },
  { pattern: /Due to the fact that/gi, replacement: "Because" },
  { pattern: /For the purpose of/gi, replacement: "For" },
  { pattern: /In the event that/gi, replacement: "If" },
  { pattern: /With regard to/gi, replacement: "About" },
  { pattern: /In regards to/gi, replacement: "About" },
  { pattern: /Pertaining to/gi, replacement: "About" },
  { pattern: /Prior to/gi, replacement: "Before" },
  { pattern: /Subsequent to/gi, replacement: "After" },
  { pattern: /In accordance with/gi, replacement: "Following" },
  { pattern: /—/g, replacement: " - " },
  { pattern: /–/g, replacement: " - " },
];

export type IntentFamily = 
  | 'greeting'
  | 'appliance'
  | 'heating'
  | 'ev_charger'
  | 'floor_plan'
  | 'amenity'
  | 'warranty'
  | 'safety'
  | 'general'
  | 'defect'
  | 'communal'
  | 'parking';

export const INTRO_VARIANTS: Record<IntentFamily, string[]> = {
  greeting: [
    "Hello there! How can I help you today?",
    "Hi! What can I help you with?",
    "Good to hear from you. What would you like to know?",
    "Hello! I'm here to help with anything about your home.",
    "Hi there! Fire away with any questions.",
    "Welcome! What can I help you find out today?",
    "Hello! I'm happy to help. What's on your mind?",
    "Hi! Let me know what you'd like to know about your home.",
  ],
  appliance: [
    "Looking at your appliance information...",
    "Let me check what I have on that appliance...",
    "I can help with that. Here's what I found...",
    "Good question. Your documents show...",
    "Let me pull up the details on that...",
    "I've got some information on that...",
    "Here's what I can tell you about that appliance...",
    "I can see the details in your home manual...",
  ],
  heating: [
    "Let me check your heating system details...",
    "I can help with that. Your heat pump...",
    "Good question about heating. Here's what I found...",
    "Looking at your heating information...",
    "Your heating system details show...",
    "I've got information on your heating setup...",
    "Let me find that in your home documentation...",
    "Here's what your documents say about heating...",
  ],
  ev_charger: [
    "Let me check your EV charger details...",
    "I can help with that. Your charger...",
    "Good question. Here's what I found about your EV charger...",
    "Looking at your charging point information...",
    "Your EV charger documentation shows...",
    "I've got the details on your charging setup...",
    "Let me pull up your charger specifications...",
    "Here's what I can tell you about your EV charger...",
  ],
  floor_plan: [
    "Let me check your floor plan...",
    "Looking at your home layout...",
    "I can help with that. Your floor plan shows...",
    "Good question. Here's what your drawings show...",
    "Your floor plan documentation indicates...",
    "I've got your layout details here...",
    "Let me pull up the measurements...",
    "Here's what I can see from your floor plan...",
  ],
  amenity: [
    "Let me look up what's nearby...",
    "I can help find that for you...",
    "Looking at what's in your area...",
    "Good question. Nearby options include...",
    "I've checked what's around your location...",
    "Here's what I found in your area...",
    "Let me see what's close to you...",
    "I can tell you about nearby places...",
  ],
  warranty: [
    "Let me check your warranty information...",
    "I can help with that. Your warranty covers...",
    "Good question about warranty. Here's what I found...",
    "Looking at your warranty details...",
    "Your warranty documentation shows...",
    "I've got the warranty information here...",
    "Let me find the warranty terms...",
    "Here's what your warranty covers...",
  ],
  safety: [
    "This is important.",
    "Please pay attention to this.",
    "Here's what you need to know.",
    "This is a safety matter.",
    "I need to share something important.",
    "Please note the following carefully.",
    "This requires your attention.",
    "Here's the key information.",
  ],
  general: [
    "Let me check that for you...",
    "I can help with that...",
    "Good question. Here's what I found...",
    "Looking into that now...",
    "I've got some information on that...",
    "Let me see what I can find...",
    "Here's what your documents show...",
    "I can tell you about that...",
  ],
  defect: [
    "I understand you're reporting an issue.",
    "Thanks for letting me know about this.",
    "I can help you get this looked at.",
    "Let me help you with this concern.",
    "I'll point you in the right direction for this.",
    "Thanks for flagging this up.",
    "I can help you report this properly.",
    "Let me help you get this sorted.",
  ],
  communal: [
    "For communal area queries...",
    "Regarding the shared spaces...",
    "I can help with that communal matter...",
    "Looking at the communal area information...",
    "For questions about shared facilities...",
    "I've got information on the communal areas...",
    "Let me check the communal area details...",
    "Here's what I know about the shared spaces...",
  ],
  parking: [
    "Let me check the parking arrangements...",
    "I can help with that parking query...",
    "Looking at your parking information...",
    "Good question about parking. Here's what I found...",
    "Your parking details show...",
    "I've got the parking information here...",
    "Let me find the parking details...",
    "Here's what I can tell you about parking...",
  ],
};

export const LOW_CONFIDENCE_INTROS: string[] = [
  "I don't have specific details on that in your documents, but I can point you in the right direction.",
  "I can't see that information in your home manual yet, though here's what might help...",
  "That's not something I have to hand right now. Here's what I'd suggest...",
  "I don't have the full picture on that, but I can help you find out more.",
  "I'm not seeing that in your documents, but let me help you get an answer.",
  "I don't have that specific detail, though I can suggest the next step.",
  "That's outside what I have recorded, but here's how to find out...",
  "I can't confirm that from your documents. Here's what I'd recommend...",
];

export const SAFETY_INTROS: string[] = [
  "This is a safety matter that needs proper attention.",
  "For your safety, please read this carefully.",
  "This is important safety information.",
  "Please pay close attention to this safety guidance.",
  "Safety first. Here's what you need to know.",
  "This requires careful attention for safety reasons.",
  "I need to give you some important safety information.",
  "Please follow this safety guidance carefully.",
];

export const NO_FOLLOW_UP_INTENTS: string[] = [
  'emergency',
  'safety',
  'gas_leak',
  'fire',
  'electrical_emergency',
  'flood',
  'structural_danger',
  'medical',
];

export function mapIntentToFamily(intent: string): IntentFamily {
  const normalizedIntent = intent.toLowerCase();
  
  if (normalizedIntent.includes('greet') || normalizedIntent === 'hello' || normalizedIntent === 'hi') {
    return 'greeting';
  }
  if (normalizedIntent.includes('heat') || normalizedIntent.includes('daikin') || normalizedIntent.includes('boiler')) {
    return 'heating';
  }
  if (normalizedIntent.includes('ev') || normalizedIntent.includes('charger') || normalizedIntent.includes('ohme')) {
    return 'ev_charger';
  }
  if (normalizedIntent.includes('appliance') || normalizedIntent.includes('oven') || normalizedIntent.includes('dishwasher')) {
    return 'appliance';
  }
  if (normalizedIntent.includes('floor') || normalizedIntent.includes('layout') || normalizedIntent.includes('dimension')) {
    return 'floor_plan';
  }
  if (normalizedIntent.includes('amenity') || normalizedIntent.includes('nearby') || normalizedIntent.includes('local')) {
    return 'amenity';
  }
  if (normalizedIntent.includes('warranty') || normalizedIntent.includes('guarantee')) {
    return 'warranty';
  }
  if (normalizedIntent.includes('safety') || normalizedIntent.includes('emergency') || normalizedIntent.includes('gas') || normalizedIntent.includes('fire')) {
    return 'safety';
  }
  if (normalizedIntent.includes('defect') || normalizedIntent.includes('snag') || normalizedIntent.includes('issue') || normalizedIntent.includes('broken')) {
    return 'defect';
  }
  if (normalizedIntent.includes('communal') || normalizedIntent.includes('common') || normalizedIntent.includes('shared')) {
    return 'communal';
  }
  if (normalizedIntent.includes('parking') || normalizedIntent.includes('car')) {
    return 'parking';
  }
  
  return 'general';
}

export function getRandomIntro(intentFamily: IntentFamily): string {
  const variants = INTRO_VARIANTS[intentFamily] || INTRO_VARIANTS.general;
  return variants[Math.floor(Math.random() * variants.length)];
}

export function getRandomLowConfidenceIntro(): string {
  return LOW_CONFIDENCE_INTROS[Math.floor(Math.random() * LOW_CONFIDENCE_INTROS.length)];
}

export function getRandomSafetyIntro(): string {
  return SAFETY_INTROS[Math.floor(Math.random() * SAFETY_INTROS.length)];
}

export function applyPhraseReplacements(text: string): string {
  let result = text;
  for (const { pattern, replacement } of BANNED_PHRASES) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export function removeEmDashes(text: string): string {
  return text.replace(/—/g, ' - ').replace(/–/g, ' - ');
}

export function isNoFollowUpIntent(intent: string): boolean {
  const normalized = intent.toLowerCase();
  return NO_FOLLOW_UP_INTENTS.some(blocked => normalized.includes(blocked));
}
