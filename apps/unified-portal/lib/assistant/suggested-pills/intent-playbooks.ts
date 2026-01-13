export interface IntentPlaybook {
  id: string;
  intentKey: string;
  objective: string;
  defaultAssumptions: string[];
  dataPriority: string[];
  responseStructure: {
    framing: string;
    bestPractice: string;
    schemeSpecific: string;
    commonMistakes: string;
    nextActions: string;
  };
  hardConstraints: string[];
  clarifyingQuestionTriggers: string[];
}

export const INTENT_PLAYBOOKS: Record<string, IntentPlaybook> = {
  'home.kitchen.layout': {
    id: 'intent_home_kitchen_layout',
    intentKey: 'home.kitchen.layout',
    objective: 'Help the homeowner think through kitchen layout options and workflow optimisation',
    defaultAssumptions: [
      'User has a standard modern kitchen with fitted units',
      'User wants practical, daily-use improvements'
    ],
    dataPriority: ['scheme floor plans', 'scheme kitchen specifications', 'general kitchen layout principles'],
    responseStructure: {
      framing: 'Acknowledge this is about making their kitchen work better for daily life',
      bestPractice: 'Cover the kitchen work triangle, storage zones, lighting considerations',
      schemeSpecific: 'Only mention if floor plan or kitchen specs are in provided data',
      commonMistakes: 'Blocking traffic flow, insufficient counter space near appliances',
      nextActions: 'Suggest measuring current setup, sketching ideas, consulting kitchen fitters'
    },
    hardConstraints: [
      'Do not assume kitchen dimensions',
      'Do not recommend specific kitchen suppliers',
      'Do not claim knowledge of exact layout'
    ],
    clarifyingQuestionTriggers: [
      'User asks about specific appliance placement',
      'User mentions renovation plans'
    ]
  },

  'home.storage.optimisation': {
    id: 'intent_home_storage_optimisation',
    intentKey: 'home.storage.optimisation',
    objective: 'Provide practical storage ideas that maximise space in a new home',
    defaultAssumptions: [
      'User has standard new-build storage provisions',
      'User wants to optimise existing spaces'
    ],
    dataPriority: ['scheme storage specifications', 'general storage best practices'],
    responseStructure: {
      framing: 'Focus on making the most of what they have',
      bestPractice: 'Cover vertical space, under-stair areas, built-in options, seasonal rotation',
      schemeSpecific: 'Only cite if storage specs are in provided data',
      commonMistakes: 'Underusing vertical space, cluttering accessible areas',
      nextActions: 'Suggest audit of current items, prioritisation of frequently used items'
    },
    hardConstraints: [
      'Do not assume room sizes or number of rooms',
      'Do not recommend specific storage brands'
    ],
    clarifyingQuestionTriggers: [
      'User asks about specific room',
      'User mentions particular items to store'
    ]
  },

  'home.living_room.layout': {
    id: 'intent_home_living_room_layout',
    intentKey: 'home.living_room.layout',
    objective: 'Help homeowner arrange living room for comfort and functionality',
    defaultAssumptions: [
      'User has a standard new-build living room',
      'User wants balance of comfort and practicality'
    ],
    dataPriority: ['scheme floor plans', 'general living room design principles'],
    responseStructure: {
      framing: 'Focus on creating a comfortable, functional space',
      bestPractice: 'Cover focal points, traffic flow, conversation areas, lighting layers',
      schemeSpecific: 'Only mention if living room specs in provided data',
      commonMistakes: 'Pushing all furniture against walls, blocking natural light',
      nextActions: 'Suggest sketching current layout, experimenting with arrangements'
    },
    hardConstraints: [
      'Do not assume room dimensions or orientation',
      'Do not recommend specific furniture brands'
    ],
    clarifyingQuestionTriggers: [
      'User asks about specific furniture placement',
      'User mentions room feels cramped or empty'
    ]
  },

  'home.upgrades.value': {
    id: 'intent_home_upgrades_value',
    intentKey: 'home.upgrades.value',
    objective: 'Suggest upgrades that improve daily living (NOT resale framing)',
    defaultAssumptions: [
      'User wants practical improvements',
      'Focus is on enjoying the home, not investment returns'
    ],
    dataPriority: ['scheme specifications', 'general home improvement best practices'],
    responseStructure: {
      framing: 'Focus on daily comfort and convenience, never resale value',
      bestPractice: 'Cover energy efficiency, comfort, convenience, outdoor living',
      schemeSpecific: 'Only cite existing features if in provided data',
      commonMistakes: 'Over-personalising, ignoring planning requirements',
      nextActions: 'Prioritise by impact on daily life, check if planning needed'
    },
    hardConstraints: [
      'Never frame as investment or resale value',
      'Do not recommend specific contractors',
      'Do not assume budget'
    ],
    clarifyingQuestionTriggers: [
      'User asks about cost',
      'User asks about specific upgrade type'
    ]
  },

  'home.garden.low_maintenance': {
    id: 'intent_home_garden_low_maintenance',
    intentKey: 'home.garden.low_maintenance',
    objective: 'Guide homeowner to create an enjoyable, low-effort garden',
    defaultAssumptions: [
      'User has a standard new-build garden',
      'Garden is likely a blank canvas or basic lawn'
    ],
    dataPriority: ['scheme garden specifications', 'Irish climate gardening practices'],
    responseStructure: {
      framing: 'Creating outdoor space that is enjoyable without constant work',
      bestPractice: 'Cover native plants, perennials, ground cover, mulching, hardscaping',
      schemeSpecific: 'Only cite garden size/orientation if in provided data',
      commonMistakes: 'Choosing high-maintenance plants, neglecting soil prep',
      nextActions: 'Assess sunlight patterns, plan zones, start small'
    },
    hardConstraints: [
      'Do not assume garden size or orientation',
      'Do not recommend specific garden centres'
    ],
    clarifyingQuestionTriggers: [
      'User asks about specific plants',
      'User mentions specific garden feature'
    ]
  },

  'home.external.value': {
    id: 'intent_home_external_value',
    intentKey: 'home.external.value',
    objective: 'Suggest external improvements for daily enjoyment (NOT resale)',
    defaultAssumptions: [
      'User wants to improve outdoor living',
      'Focus on enjoyment, not property value'
    ],
    dataPriority: ['scheme external specifications', 'general external improvement practices'],
    responseStructure: {
      framing: 'Creating outdoor spaces you will actually use and enjoy',
      bestPractice: 'Cover patios, lighting, screening, outdoor storage, planting',
      schemeSpecific: 'Only cite if external specs in provided data',
      commonMistakes: 'Ignoring maintenance requirements, forgetting about Irish weather',
      nextActions: 'Consider how you want to use the space, check planning if needed'
    },
    hardConstraints: [
      'Never frame as investment or kerb appeal for selling',
      'Do not recommend specific contractors',
      'Do not assume garden size'
    ],
    clarifyingQuestionTriggers: [
      'User asks about specific feature',
      'User mentions planning permission concerns'
    ]
  },

  'home.energy.heating': {
    id: 'intent_home_energy_heating',
    intentKey: 'home.energy.heating',
    objective: 'Explain heating system operation and efficient use',
    defaultAssumptions: [
      'User has a modern efficient heating system',
      'User wants to understand controls and optimise comfort'
    ],
    dataPriority: ['scheme heating specifications', 'BER data', 'general heating best practices'],
    responseStructure: {
      framing: 'Help understand the system and use it efficiently',
      bestPractice: 'Cover thermostat use, timing schedules, zone control, TRVs',
      schemeSpecific: 'Only cite heating type if in provided data',
      commonMistakes: 'Overheating, inefficient timing, blocking radiators',
      nextActions: 'Learn controls, set schedules, annual service reminder'
    },
    hardConstraints: [
      'Do not assume specific heating system type unless in data',
      'Do not provide specific cost estimates'
    ],
    clarifyingQuestionTriggers: [
      'User asks about specific controls',
      'User reports heating not working properly'
    ]
  },

  'home.energy.cost_reduction': {
    id: 'intent_home_energy_cost_reduction',
    intentKey: 'home.energy.cost_reduction',
    objective: 'Provide practical energy cost reduction guidance',
    defaultAssumptions: [
      'User has a well-insulated new home',
      'User wants to reduce running costs'
    ],
    dataPriority: ['scheme energy specifications', 'BER data', 'SEAI guidance'],
    responseStructure: {
      framing: 'Practical steps to reduce energy bills',
      bestPractice: 'Cover usage habits, tariff switching, grants available, draught-proofing',
      schemeSpecific: 'Only cite BER or energy features if in provided data',
      commonMistakes: 'Leaving appliances on standby, inefficient heating schedules',
      nextActions: 'Check current usage, compare tariffs, explore grants'
    },
    hardConstraints: [
      'Do not guarantee specific savings amounts',
      'Do not recommend specific energy providers',
      'Direct to SEAI for grant information'
    ],
    clarifyingQuestionTriggers: [
      'User asks about specific appliance',
      'User mentions high bills'
    ]
  },

  'home.energy.ev_charging': {
    id: 'intent_home_energy_ev_charging',
    intentKey: 'home.energy.ev_charging',
    objective: 'Guide homeowner on EV charging options and considerations',
    defaultAssumptions: [
      'User is considering or has an EV',
      'User wants to understand home charging options'
    ],
    dataPriority: ['scheme EV specifications', 'SEAI EV grant info', 'general EV charging guidance'],
    responseStructure: {
      framing: 'Understanding home EV charging options',
      bestPractice: 'Cover charger types, installation requirements, smart charging, grants',
      schemeSpecific: 'Only cite if EV charging provisions in provided data',
      commonMistakes: 'Underestimating power requirements, not claiming grants',
      nextActions: 'Check electrical capacity, get quotes, apply for grants'
    },
    hardConstraints: [
      'Do not recommend specific charger brands',
      'Do not assume electrical setup',
      'Direct to SEAI for current grant info'
    ],
    clarifyingQuestionTriggers: [
      'User asks about specific charger',
      'User mentions installation concerns'
    ]
  },

  'home.smart_home.practical': {
    id: 'intent_home_smart_home_practical',
    intentKey: 'home.smart_home.practical',
    objective: 'Suggest practical smart home features that add genuine value',
    defaultAssumptions: [
      'User is curious about smart home tech',
      'User wants practical benefits, not just novelty'
    ],
    dataPriority: ['scheme smart home features', 'general smart home best practices'],
    responseStructure: {
      framing: 'Focus on practical benefits and genuine convenience',
      bestPractice: 'Cover heating controls, lighting, security, energy monitoring',
      schemeSpecific: 'Only cite existing smart features if in provided data',
      commonMistakes: 'Overcomplicating, poor WiFi coverage, compatibility issues',
      nextActions: 'Start with one area, ensure good WiFi, check compatibility'
    },
    hardConstraints: [
      'Do not recommend specific brands unless asked',
      'Do not assume existing smart infrastructure'
    ],
    clarifyingQuestionTriggers: [
      'User asks about specific devices',
      'User mentions particular smart home goal'
    ]
  },

  'home.maintenance.year_one': {
    id: 'intent_home_maintenance_year_one',
    intentKey: 'home.maintenance.year_one',
    objective: 'Guide first-year maintenance tasks for new homeowners',
    defaultAssumptions: [
      'User has recently moved into a new build',
      'Home is under snagging and warranty period'
    ],
    dataPriority: ['scheme maintenance guidance', 'developer handover docs', 'general new home care'],
    responseStructure: {
      framing: 'Getting to know your new home and keeping it in great condition',
      bestPractice: 'Cover seasonal checks, ventilation, heating service, snagging follow-up',
      schemeSpecific: 'Only cite if maintenance schedule in provided data',
      commonMistakes: 'Ignoring condensation, not logging snags, missing service deadlines',
      nextActions: 'Create maintenance calendar, note any issues, schedule services'
    },
    hardConstraints: [
      'Do not claim knowledge of specific warranty terms unless in data',
      'Do not recommend specific service providers'
    ],
    clarifyingQuestionTriggers: [
      'User reports specific issue',
      'User asks about timing of specific task'
    ]
  },

  'home.maintenance.long_term': {
    id: 'intent_home_maintenance_long_term',
    intentKey: 'home.maintenance.long_term',
    objective: 'Help homeowner plan for long-term home maintenance',
    defaultAssumptions: [
      'User wants to understand future maintenance needs',
      'Home is a modern new build'
    ],
    dataPriority: ['scheme specifications', 'general home maintenance schedules'],
    responseStructure: {
      framing: 'Planning ahead to protect your investment and avoid surprises',
      bestPractice: 'Cover 5-year, 10-year, 20-year typical maintenance needs',
      schemeSpecific: 'Only cite if specific materials/systems in provided data',
      commonMistakes: 'Deferring maintenance, not budgeting for future work',
      nextActions: 'Create long-term plan, set aside maintenance fund'
    },
    hardConstraints: [
      'Do not guarantee maintenance timelines',
      'Do not recommend specific contractors'
    ],
    clarifyingQuestionTriggers: [
      'User asks about specific system',
      'User asks about costs'
    ]
  },

  'home.warranties.coverage': {
    id: 'intent_home_warranties_coverage',
    intentKey: 'home.warranties.coverage',
    objective: 'Explain typical warranty coverage and how to use it',
    defaultAssumptions: [
      'User has a new home with standard warranty structure',
      'User wants to understand their protections'
    ],
    dataPriority: ['scheme warranty documents', 'HomeBond/Premier Guarantee info', 'general warranty guidance'],
    responseStructure: {
      framing: 'Understanding what protections you have',
      bestPractice: 'Explain typical warranty categories, reporting procedures, documentation',
      schemeSpecific: 'Only cite specific coverage if warranty docs in provided data',
      commonMistakes: 'Missing claim deadlines, not documenting issues properly',
      nextActions: 'Review warranty documents, know who to contact, keep records'
    },
    hardConstraints: [
      'Do not confirm specific warranty terms unless in provided data',
      'Direct user to check their specific warranty documents'
    ],
    clarifyingQuestionTriggers: [
      'User asks about specific issue coverage',
      'User asks about claim process'
    ]
  },

  'home.services.utilities': {
    id: 'intent_home_services_utilities',
    intentKey: 'home.services.utilities',
    objective: 'Guide utility setup and account management',
    defaultAssumptions: [
      'User needs to set up or manage utility accounts',
      'Standard Irish utility setup applies'
    ],
    dataPriority: ['scheme utility specifications', 'MPRN/GPRN info', 'general utility guidance'],
    responseStructure: {
      framing: 'Getting your essential services set up smoothly',
      bestPractice: 'Cover electricity, gas, water registration, meter reading, switching',
      schemeSpecific: 'Only cite MPRN/GPRN if in provided data',
      commonMistakes: 'Not taking meter readings, missing cheaper tariffs',
      nextActions: 'Register accounts, record meter readings, compare providers'
    },
    hardConstraints: [
      'Do not recommend specific utility providers',
      'Do not guess account numbers or MPRNs'
    ],
    clarifyingQuestionTriggers: [
      'User asks about specific utility',
      'User mentions billing issue'
    ]
  },

  'home.services.broadband': {
    id: 'intent_home_services_broadband',
    intentKey: 'home.services.broadband',
    objective: 'Guide broadband options and setup',
    defaultAssumptions: [
      'User wants reliable home broadband',
      'Fibre likely available in new development'
    ],
    dataPriority: ['scheme broadband specifications', 'general broadband guidance'],
    responseStructure: {
      framing: 'Getting connected with reliable broadband',
      bestPractice: 'Cover fibre availability check, speed needs, router placement, WiFi coverage',
      schemeSpecific: 'Only cite if broadband specs in provided data',
      commonMistakes: 'Poor router placement, not checking actual speeds, oversized packages',
      nextActions: 'Check availability at address, assess needs, compare packages'
    },
    hardConstraints: [
      'Do not recommend specific broadband providers',
      'Do not guarantee speeds available'
    ],
    clarifyingQuestionTriggers: [
      'User asks about specific provider',
      'User mentions coverage issues'
    ]
  },

  'area.transport.options': {
    id: 'intent_area_transport_options',
    intentKey: 'area.transport.options',
    objective: 'Provide guidance on local public transport options',
    defaultAssumptions: [
      'User wants to know about transport near their home',
      'Standard Irish transport networks apply'
    ],
    dataPriority: ['scheme location data', 'local transport info if available', 'general transport guidance'],
    responseStructure: {
      framing: 'Getting around from your new home',
      bestPractice: 'Cover bus, rail, Leap card, journey planning apps',
      schemeSpecific: 'Only cite specific stops/routes if in provided data',
      commonMistakes: 'Not using real-time apps, missing off-peak savings',
      nextActions: 'Check Transport for Ireland, get Leap card, download apps'
    },
    hardConstraints: [
      'Do not invent bus routes or train stations',
      'Direct to Transport for Ireland for schedules'
    ],
    clarifyingQuestionTriggers: [
      'User asks about specific destination',
      'User asks about commute'
    ]
  },

  'area.local.amenities': {
    id: 'intent_area_local_amenities',
    intentKey: 'area.local.amenities',
    objective: 'Help homeowner discover local amenities',
    defaultAssumptions: [
      'User is new to the area',
      'User wants to find essential and convenient services'
    ],
    dataPriority: ['scheme location data', 'local amenities data if available', 'general discovery guidance'],
    responseStructure: {
      framing: 'Discovering what is around you',
      bestPractice: 'Cover types of amenities to look for, how to find them, community resources',
      schemeSpecific: 'Only cite specific amenities if in provided data',
      commonMistakes: 'Not exploring beyond main roads, missing local groups',
      nextActions: 'Walk the neighbourhood, check Google Maps, join local groups'
    },
    hardConstraints: [
      'Do not invent shop names or distances',
      'Suggest how to find information rather than asserting facts'
    ],
    clarifyingQuestionTriggers: [
      'User asks about specific type of amenity',
      'User asks about distance'
    ]
  },

  'area.local.insights': {
    id: 'intent_area_local_insights',
    intentKey: 'area.local.insights',
    objective: 'Share general insights about the local area',
    defaultAssumptions: [
      'User wants to feel more connected to the area',
      'User is interested in community and history'
    ],
    dataPriority: ['scheme area info', 'local history knowledge base', 'general community guidance'],
    responseStructure: {
      framing: 'Getting to know your new community',
      bestPractice: 'Cover community events, local character, things to explore',
      schemeSpecific: 'Only cite local history if in knowledge base for this scheme',
      commonMistakes: 'Not engaging with neighbours, missing local events',
      nextActions: 'Introduce yourself to neighbours, check local noticeboards, explore'
    },
    hardConstraints: [
      'Do not invent local history',
      'Only cite history from local history knowledge base'
    ],
    clarifyingQuestionTriggers: [
      'User asks about specific aspect of area',
      'User asks about history'
    ]
  },

  'home.planning.permission': {
    id: 'intent_home_planning_permission',
    intentKey: 'home.planning.permission',
    objective: 'Explain planning permission basics and how to check requirements',
    defaultAssumptions: [
      'User is considering home modifications',
      'Standard Irish planning rules apply'
    ],
    dataPriority: ['scheme planning restrictions', 'general Irish planning guidance'],
    responseStructure: {
      framing: 'Understanding when you need permission',
      bestPractice: 'Cover exempt development, how to check, application process',
      schemeSpecific: 'Only cite restrictions if in provided data',
      commonMistakes: 'Assuming all work is exempt, not checking with local authority',
      nextActions: 'Check local authority website, consult architect if unsure'
    },
    hardConstraints: [
      'Do not confirm specific exemptions apply to their property',
      'Always recommend checking with local planning authority'
    ],
    clarifyingQuestionTriggers: [
      'User asks about specific work',
      'User mentions past planning issues'
    ]
  },

  'home.insurance.guidance': {
    id: 'intent_home_insurance_guidance',
    intentKey: 'home.insurance.guidance',
    objective: 'Explain home insurance basics and considerations',
    defaultAssumptions: [
      'User needs to arrange or review home insurance',
      'Standard Irish home insurance applies'
    ],
    dataPriority: ['scheme specifications', 'general home insurance guidance'],
    responseStructure: {
      framing: 'Understanding and choosing home insurance',
      bestPractice: 'Cover buildings vs contents, rebuild cost, common exclusions, comparing quotes',
      schemeSpecific: 'Only cite if insurance requirements in provided data',
      commonMistakes: 'Underinsuring, not updating after improvements, ignoring excess',
      nextActions: 'Calculate rebuild cost, inventory contents, compare quotes'
    },
    hardConstraints: [
      'Do not recommend specific insurers',
      'Do not provide cost estimates',
      'Do not confirm rebuild values'
    ],
    clarifyingQuestionTriggers: [
      'User asks about specific coverage',
      'User asks about cost'
    ]
  }
};

export function getIntentPlaybook(intentKey: string): IntentPlaybook | undefined {
  return INTENT_PLAYBOOKS[intentKey];
}

export function buildIntentSystemPrompt(playbook: IntentPlaybook): string {
  return `## Intent: ${playbook.intentKey}

### Objective
${playbook.objective}

### Default Assumptions
${playbook.defaultAssumptions.map(a => `- ${a}`).join('\n')}

### Data Priority
${playbook.dataPriority.map((d, i) => `${i + 1}. ${d}`).join('\n')}

### Response Structure
1. **Framing:** ${playbook.responseStructure.framing}
2. **Best Practice:** ${playbook.responseStructure.bestPractice}
3. **Scheme-Specific:** ${playbook.responseStructure.schemeSpecific}
4. **Common Mistakes to Avoid:** ${playbook.responseStructure.commonMistakes}
5. **Next Actions:** ${playbook.responseStructure.nextActions}

### Hard Constraints
${playbook.hardConstraints.map(c => `- ${c}`).join('\n')}

### When to Ask Clarifying Questions
${playbook.clarifyingQuestionTriggers.map(t => `- ${t}`).join('\n')}`;
}
