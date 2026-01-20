/**
 * Capability Map for Proactive Next Best Action
 *
 * Defines what capabilities are available for each intent category
 * and what suggestions can be made when those capabilities are met.
 *
 * CRITICAL: Never suggest actions the system cannot fulfil.
 */

export type CapabilityType =
  | 'docs_available'
  | 'scheme_location'
  | 'places_api'
  | 'session_memory'
  | 'unit_info'
  | 'floor_plans'
  | 'drawings'
  | 'local_history';

export type SupportedLanguage = 'en' | 'pl' | 'es' | 'ru' | 'pt' | 'lv' | 'lt' | 'ro' | 'ga';

export interface Capability {
  type: CapabilityType;
  present: boolean;
  metadata?: Record<string, any>;
}

export interface IntentCapability {
  intent: string;
  requires: CapabilityType[];
  suggestions: string[];
  shortSuggestions?: string[]; // Shorter alternatives for inline use
  // Translations for suggestions
  translations?: Partial<Record<SupportedLanguage, string[]>>;
}

export const CAPABILITY_MAP: IntentCapability[] = [
  // HEATING & UTILITIES
  {
    intent: 'heating',
    requires: ['docs_available'],
    suggestions: [
      "If you tell me which room or zone is affected, I can point you to the specific control settings.",
      "Would you like me to explain how to set heating schedules or timers?"
    ],
    shortSuggestions: [
      "Need help with a specific room or zone?",
      "Want info on heating schedules?"
    ]
  },
  {
    intent: 'boiler',
    requires: ['docs_available'],
    suggestions: [
      "If you share your house type, I can pull the correct boiler manual section.",
      "Would you like info on servicing schedules or warranty details?"
    ],
    shortSuggestions: [
      "Need the boiler manual for your house type?",
      "Want warranty or servicing info?"
    ]
  },
  {
    intent: 'heat_pump',
    requires: ['docs_available'],
    suggestions: [
      "Would you like me to explain how to adjust the heat pump settings?",
      "Need info on heat pump maintenance or efficiency tips?"
    ]
  },
  
  // SNAGGING & DEFECTS
  {
    intent: 'snagging',
    requires: ['docs_available'],
    suggestions: [
      "Would you like me to explain the snagging reporting process?",
      "Need info on what's covered under the defects liability period?"
    ]
  },
  {
    intent: 'defects',
    requires: ['docs_available'],
    suggestions: [
      "Would you like details on the warranty coverage for this issue?",
      "Need the contact details for reporting defects?"
    ]
  },
  
  // AMENITIES & LOCATION
  {
    intent: 'amenities',
    requires: ['scheme_location', 'places_api'],
    suggestions: [
      "If you tell me what you're looking for (cafes, gyms, shops), I can list the closest options.",
      "Want places that are walkable, or is a short drive fine?"
    ],
    shortSuggestions: [
      "Looking for specific places nearby?",
      "Prefer walkable or driving distance?"
    ]
  },
  {
    intent: 'schools',
    requires: ['scheme_location', 'places_api'],
    suggestions: [
      "Would you like me to show primary schools, secondary schools, or both?",
      "Need info on school catchment areas?"
    ]
  },
  {
    intent: 'transport',
    requires: ['scheme_location', 'places_api'],
    suggestions: [
      "Would you like bus stops, train stations, or both?",
      "Need info on commute times to the city centre?"
    ]
  },
  
  // PROPERTY INFO
  {
    intent: 'floor_plan',
    requires: ['floor_plans'],
    suggestions: [
      "Would you like me to show floor plans for a specific level?",
      "Need dimensions for a particular room?"
    ]
  },
  {
    intent: 'drawings',
    requires: ['drawings'],
    suggestions: [
      "Would you like electrical, plumbing, or structural drawings?",
      "Need details on a specific room?"
    ]
  },
  
  // WARRANTIES
  {
    intent: 'warranty',
    requires: ['docs_available'],
    suggestions: [
      "Would you like details on what's covered under your HomeBond warranty?",
      "Need info on how to make a warranty claim?"
    ]
  },
  
  // MANAGEMENT & CONTACTS
  {
    intent: 'contacts',
    requires: ['docs_available'],
    suggestions: [
      "Need the contact for a specific issue (maintenance, management, developer)?",
      "Would you like emergency contact numbers?"
    ]
  },
  {
    intent: 'management',
    requires: ['docs_available'],
    suggestions: [
      "Would you like info on management fees or services?",
      "Need contact details for the management company?"
    ]
  },
  
  // LOCAL HISTORY (Longview/Rathard only)
  {
    intent: 'local_history',
    requires: ['local_history'],
    suggestions: [
      "Would you like to hear more about the archaeology, folklore, or notable people from the area?",
      "Interested in the trade history or War of Independence stories?"
    ]
  },
  
  // MOVING & SETTLING IN
  {
    intent: 'moving',
    requires: ['docs_available'],
    suggestions: [
      "Would you like a checklist of things to do when moving in?",
      "Need info on setting up utilities or broadband?"
    ]
  },
  {
    intent: 'bins',
    requires: ['docs_available'],
    suggestions: [
      "Would you like info on bin collection days?",
      "Need details on recycling or composting?"
    ]
  },
  
  // GENERAL FALLBACK
  {
    intent: 'general',
    requires: ['docs_available'],
    suggestions: [
      "Is there anything specific about your home or development I can help with?",
      "Would you like info on amenities, maintenance, or community facilities?"
    ],
    translations: {
      pl: [
        "Czy jest coś konkretnego dotyczącego Twojego domu lub osiedla, w czym mogę pomóc?",
        "Czy chciałbyś informacji o udogodnieniach, konserwacji lub obiektach wspólnych?"
      ],
      es: [
        "¿Hay algo específico sobre tu hogar o urbanización en lo que pueda ayudarte?",
        "¿Te gustaría información sobre servicios, mantenimiento o instalaciones comunitarias?"
      ],
      ru: [
        "Есть ли что-то конкретное о вашем доме или жилом комплексе, чем я могу помочь?",
        "Хотите информацию об удобствах, обслуживании или общих объектах?"
      ],
      pt: [
        "Há algo específico sobre a sua casa ou empreendimento em que eu possa ajudar?",
        "Gostaria de informações sobre comodidades, manutenção ou instalações comunitárias?"
      ],
      lv: [
        "Vai ir kaut kas konkrēts par jūsu māju vai attīstību, ar ko es varu palīdzēt?",
        "Vai vēlaties informāciju par ērtībām, apkopi vai kopienas telpām?"
      ],
      lt: [
        "Ar yra kažkas konkretaus apie jūsų namus ar gyvenamąjį kompleksą, kuo galiu padėti?",
        "Ar norėtumėte informacijos apie patogumus, priežiūrą ar bendruomenės patalpas?"
      ],
      ro: [
        "Este ceva specific despre locuința sau ansamblul tău cu care te pot ajuta?",
        "Dorești informații despre facilități, întreținere sau dotări comune?"
      ],
      ga: [
        "An bhfuil aon rud ar leith faoi do theach nó do phobal ar féidir liom cabhrú leat?",
        "Ar mhaith leat eolas faoi áiseanna, cothabháil nó saoráidí pobail?"
      ]
    }
  }
];

/**
 * Get suggestions for an intent in the specified language
 */
export function getSuggestionsForLanguage(
  capability: IntentCapability,
  language: SupportedLanguage
): string[] {
  // If English or no translations available, return default suggestions
  if (language === 'en' || !capability.translations) {
    return capability.suggestions;
  }

  // Return translated suggestions if available, otherwise fall back to English
  return capability.translations[language] || capability.suggestions;
}

export function getCapabilityForIntent(intent: string): IntentCapability | null {
  // Direct match
  let capability = CAPABILITY_MAP.find(c => c.intent === intent);
  if (capability) return capability;
  
  // Fuzzy match based on keywords
  const intentLower = intent.toLowerCase();
  
  if (intentLower.includes('heat') || intentLower.includes('radiator') || intentLower.includes('thermostat')) {
    return CAPABILITY_MAP.find(c => c.intent === 'heating') || null;
  }
  if (intentLower.includes('boiler')) {
    return CAPABILITY_MAP.find(c => c.intent === 'boiler') || null;
  }
  if (intentLower.includes('school')) {
    return CAPABILITY_MAP.find(c => c.intent === 'schools') || null;
  }
  if (intentLower.includes('shop') || intentLower.includes('cafe') || intentLower.includes('restaurant') || intentLower.includes('gym')) {
    return CAPABILITY_MAP.find(c => c.intent === 'amenities') || null;
  }
  if (intentLower.includes('snag')) {
    return CAPABILITY_MAP.find(c => c.intent === 'snagging') || null;
  }
  if (intentLower.includes('warranty') || intentLower.includes('homebond')) {
    return CAPABILITY_MAP.find(c => c.intent === 'warranty') || null;
  }
  if (intentLower.includes('floor') || intentLower.includes('plan')) {
    return CAPABILITY_MAP.find(c => c.intent === 'floor_plan') || null;
  }
  if (intentLower.includes('history') || intentLower.includes('heritage')) {
    return CAPABILITY_MAP.find(c => c.intent === 'local_history') || null;
  }
  if (intentLower.includes('bin') || intentLower.includes('waste') || intentLower.includes('recycl')) {
    return CAPABILITY_MAP.find(c => c.intent === 'bins') || null;
  }
  if (intentLower.includes('contact') || intentLower.includes('who do i')) {
    return CAPABILITY_MAP.find(c => c.intent === 'contacts') || null;
  }
  
  return null;
}

export function getRelatedIntents(currentIntent: string): string[] {
  const relatedMap: Record<string, string[]> = {
    'heating': ['boiler', 'heat_pump', 'warranty'],
    'boiler': ['heating', 'warranty', 'contacts'],
    'heat_pump': ['heating', 'warranty'],
    'snagging': ['defects', 'warranty', 'contacts'],
    'defects': ['snagging', 'warranty'],
    'amenities': ['schools', 'transport'],
    'schools': ['amenities', 'transport'],
    'transport': ['amenities', 'schools'],
    'floor_plan': ['drawings'],
    'drawings': ['floor_plan'],
    'warranty': ['snagging', 'defects', 'contacts'],
    'contacts': ['management', 'warranty'],
    'management': ['contacts', 'bins'],
    'moving': ['bins', 'contacts', 'amenities'],
    'bins': ['management', 'contacts'],
    'local_history': [],
  };
  
  return relatedMap[currentIntent] || [];
}
