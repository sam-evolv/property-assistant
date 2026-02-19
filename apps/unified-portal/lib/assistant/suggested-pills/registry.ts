export enum PillSector {
  HOME_LAYOUT = 'home_layout',
  GARDEN_EXTERIOR = 'garden_exterior',
  ENERGY_TECHNOLOGY = 'energy_technology',
  MAINTENANCE_OWNERSHIP = 'maintenance_ownership',
  SERVICES_SETUP = 'services_setup',
  AREA_PLANNING = 'area_planning',
  INSURANCE = 'insurance',
  LOCAL_LIFE = 'local_life',
}

export interface PillDefinition {
  id: string;
  label: string;
  sector: PillSector;
  intentKey: string;
  userVisibleQuestion: string;
  templateId: string;
  suggestedFollowups?: [string, string];
}

export const PILL_DEFINITIONS: PillDefinition[] = [
  // Home & Layout
  {
    id: 'kitchen_layout',
    label: 'Kitchen Layout',
    sector: PillSector.HOME_LAYOUT,
    intentKey: 'home.kitchen.layout',
    userVisibleQuestion: 'What are some ideas for my kitchen layout?',
    templateId: 'intent_home_kitchen_layout',
    suggestedFollowups: ['What about storage in the kitchen?', 'How can I maximise counter space?']
  },
  {
    id: 'storage_ideas',
    label: 'Storage Ideas',
    sector: PillSector.HOME_LAYOUT,
    intentKey: 'home.storage.optimisation',
    userVisibleQuestion: 'What are some clever storage ideas for my home?',
    templateId: 'intent_home_storage_optimisation',
    suggestedFollowups: ['What about under-stairs storage?', 'How can I organise closets better?']
  },
  {
    id: 'living_room',
    label: 'Living Room',
    sector: PillSector.HOME_LAYOUT,
    intentKey: 'home.living_room.layout',
    userVisibleQuestion: 'How can I arrange my living room effectively?',
    templateId: 'intent_home_living_room_layout',
    suggestedFollowups: ['What about TV placement?', 'How do I create conversation areas?']
  },
  {
    id: 'home_upgrades',
    label: 'Home Upgrades',
    sector: PillSector.HOME_LAYOUT,
    intentKey: 'home.upgrades.value',
    userVisibleQuestion: 'What upgrades would improve my daily living?',
    templateId: 'intent_home_upgrades_value',
    suggestedFollowups: ['Which upgrades are most cost-effective?', 'What about outdoor improvements?']
  },

  // Garden & Exterior
  {
    id: 'garden_setup',
    label: 'Garden Setup',
    sector: PillSector.GARDEN_EXTERIOR,
    intentKey: 'home.garden.low_maintenance',
    userVisibleQuestion: 'How can I set up a low-maintenance garden?',
    templateId: 'intent_home_garden_low_maintenance',
    suggestedFollowups: ['What plants are easiest to care for?', 'How do I prepare the soil?']
  },
  {
    id: 'outdoor_improvements',
    label: 'Outdoor Improvements',
    sector: PillSector.GARDEN_EXTERIOR,
    intentKey: 'home.external.value',
    userVisibleQuestion: 'What outdoor improvements would benefit my home?',
    templateId: 'intent_home_external_value',
    suggestedFollowups: ['What about patio or decking?', 'How can I improve kerb appeal?']
  },

  // Energy & Technology
  {
    id: 'heating_system',
    label: 'Heating System',
    sector: PillSector.ENERGY_TECHNOLOGY,
    intentKey: 'home.energy.heating',
    userVisibleQuestion: 'How does my heating system work and how can I use it efficiently?',
    templateId: 'intent_home_energy_heating',
    suggestedFollowups: ['How do I set heating schedules?', 'What temperature is most efficient?']
  },
  {
    id: 'energy_savings',
    label: 'Energy Savings',
    sector: PillSector.ENERGY_TECHNOLOGY,
    intentKey: 'home.energy.cost_reduction',
    userVisibleQuestion: 'How can I reduce my energy costs?',
    templateId: 'intent_home_energy_cost_reduction',
    suggestedFollowups: ['Which appliances use most energy?', 'Are there grants available?']
  },
  {
    id: 'ev_charging',
    label: 'EV Charging',
    sector: PillSector.ENERGY_TECHNOLOGY,
    intentKey: 'home.energy.ev_charging',
    userVisibleQuestion: 'What should I know about EV charging at home?',
    templateId: 'intent_home_energy_ev_charging',
    suggestedFollowups: ['What charger type do I need?', 'Are there installation grants?']
  },
  {
    id: 'smart_home',
    label: 'Smart Home',
    sector: PillSector.ENERGY_TECHNOLOGY,
    intentKey: 'home.smart_home.practical',
    userVisibleQuestion: 'What smart home features would be practical for me?',
    templateId: 'intent_home_smart_home_practical',
    suggestedFollowups: ['What about smart heating controls?', 'How do I start with smart lighting?']
  },

  // Maintenance & Ownership
  {
    id: 'first_year_maintenance',
    label: 'First-Year Maintenance',
    sector: PillSector.MAINTENANCE_OWNERSHIP,
    intentKey: 'home.maintenance.year_one',
    userVisibleQuestion: 'What maintenance should I do in my first year?',
    templateId: 'intent_home_maintenance_year_one',
    suggestedFollowups: ['What about seasonal checks?', 'When should I service the boiler?']
  },
  {
    id: 'long_term_maintenance',
    label: 'Long-Term Maintenance',
    sector: PillSector.MAINTENANCE_OWNERSHIP,
    intentKey: 'home.maintenance.long_term',
    userVisibleQuestion: 'What long-term maintenance should I plan for?',
    templateId: 'intent_home_maintenance_long_term',
    suggestedFollowups: ['How often should I repaint?', 'What about roof maintenance?']
  },
  {
    id: 'warranties',
    label: 'Warranties',
    sector: PillSector.MAINTENANCE_OWNERSHIP,
    intentKey: 'home.warranties.coverage',
    userVisibleQuestion: 'What warranties cover my new home?',
    templateId: 'intent_home_warranties_coverage',
    suggestedFollowups: ['How do I make a warranty claim?', 'What is not covered?']
  },

  // Services & Setup
  {
    id: 'utilities_setup',
    label: 'Utilities Setup',
    sector: PillSector.SERVICES_SETUP,
    intentKey: 'home.services.utilities',
    userVisibleQuestion: 'How do I set up my utilities?',
    templateId: 'intent_home_services_utilities',
    suggestedFollowups: ['How do I read my meters?', 'Can I switch providers?']
  },
  {
    id: 'broadband_setup',
    label: 'Broadband Setup',
    sector: PillSector.SERVICES_SETUP,
    intentKey: 'home.services.broadband',
    userVisibleQuestion: 'What are my broadband options?',
    templateId: 'intent_home_services_broadband',
    suggestedFollowups: ['What speeds are available?', 'How do I improve WiFi coverage?']
  },

  // Area & Planning
  {
    id: 'public_transport',
    label: 'Public Transport',
    sector: PillSector.AREA_PLANNING,
    intentKey: 'area.transport.options',
    userVisibleQuestion: 'What public transport options are near me?',
    templateId: 'intent_area_transport_options',
    suggestedFollowups: ['How do I get to the city centre?', 'Are there bus routes nearby?']
  },
  {
    id: 'local_amenities',
    label: 'Local Amenities',
    sector: PillSector.AREA_PLANNING,
    intentKey: 'area.local.amenities',
    userVisibleQuestion: 'What amenities are in my local area?',
    templateId: 'intent_area_local_amenities',
    suggestedFollowups: ['Where are the nearest shops?', 'What about schools nearby?']
  },
  {
    id: 'the_area',
    label: 'The Area',
    sector: PillSector.AREA_PLANNING,
    intentKey: 'area.local.insights',
    userVisibleQuestion: 'What should I know about my local area?',
    templateId: 'intent_area_local_insights',
    suggestedFollowups: ['What community events are there?', 'Tell me about local history']
  },
  {
    id: 'planning_rules',
    label: 'Planning Rules',
    sector: PillSector.AREA_PLANNING,
    intentKey: 'home.planning.permission',
    userVisibleQuestion: 'What do I need to know about planning permission?',
    templateId: 'intent_home_planning_permission',
    suggestedFollowups: ['Do I need permission for a shed?', 'What about extensions?']
  },

  // Local Life — new features (weather, transport, amenities)
  {
    id: 'weather_today',
    label: 'Weather Today',
    sector: PillSector.LOCAL_LIFE,
    intentKey: 'local.weather.today',
    userVisibleQuestion: "What's the weather like today?",
    templateId: 'intent_local_weather_today',
    suggestedFollowups: ['What about tomorrow?', 'Will it rain this week?']
  },
  {
    id: 'buses_near_me',
    label: 'Buses Near Me',
    sector: PillSector.LOCAL_LIFE,
    intentKey: 'local.transport.buses',
    userVisibleQuestion: 'What buses are near me?',
    templateId: 'intent_local_transport_buses',
    suggestedFollowups: ['How do I get to the city centre?', 'Is there a bus to the hospital?']
  },
  {
    id: 'walk_to_town',
    label: 'Walk to Town',
    sector: PillSector.LOCAL_LIFE,
    intentKey: 'local.transport.walking',
    userVisibleQuestion: 'How long does it take to walk to town from here?',
    templateId: 'intent_local_transport_walking',
    suggestedFollowups: ['What about cycling?', 'Is it a safe walk?']
  },
  {
    id: 'nearest_pharmacy',
    label: 'Nearest Pharmacy',
    sector: PillSector.LOCAL_LIFE,
    intentKey: 'local.amenities.pharmacy',
    userVisibleQuestion: 'Where is the closest pharmacy?',
    templateId: 'intent_local_amenities_pharmacy',
    suggestedFollowups: ['What are the opening hours?', 'Is there a late-night pharmacy?']
  },
  {
    id: 'nearest_supermarket',
    label: 'Nearest Supermarket',
    sector: PillSector.LOCAL_LIFE,
    intentKey: 'local.amenities.supermarket',
    userVisibleQuestion: 'What supermarkets are near me?',
    templateId: 'intent_local_amenities_supermarket',
    suggestedFollowups: ['How far is the nearest Lidl?', 'Is there a large grocery store nearby?']
  },
  {
    id: 'local_schools',
    label: 'Local Schools',
    sector: PillSector.LOCAL_LIFE,
    intentKey: 'local.amenities.schools',
    userVisibleQuestion: 'What schools are near the development?',
    templateId: 'intent_local_amenities_schools',
    suggestedFollowups: ['Are there primary schools nearby?', 'What about secondary schools?']
  },
  {
    id: 'seai_grants',
    label: 'Home Grants',
    sector: PillSector.ENERGY_TECHNOLOGY,
    intentKey: 'home.energy.grants',
    userVisibleQuestion: 'What home improvement grants am I eligible for?',
    templateId: 'intent_home_energy_grants',
    suggestedFollowups: ['How do I apply for the EV charger grant?', 'Are there solar panel grants?']
  },
  {
    id: 'ber_explained',
    label: 'My BER Rating',
    sector: PillSector.ENERGY_TECHNOLOGY,
    intentKey: 'home.energy.ber',
    userVisibleQuestion: 'What does my BER rating mean?',
    templateId: 'intent_home_energy_ber',
    suggestedFollowups: ['How does my A-rating save me money?', 'Where do I find my BER cert?']
  },
  {
    id: 'maintenance_this_season',
    label: 'Seasonal Maintenance',
    sector: PillSector.MAINTENANCE_OWNERSHIP,
    intentKey: 'home.maintenance.seasonal',
    userVisibleQuestion: 'What home maintenance should I be doing right now?',
    templateId: 'intent_home_maintenance_seasonal',
    suggestedFollowups: ['When should I service my heat pump?', 'How often do I clean MVHR filters?']
  },
  {
    id: 'utility_setup',
    label: 'Setting Up Utilities',
    sector: PillSector.SERVICES_SETUP,
    intentKey: 'home.services.new_setup',
    userVisibleQuestion: "I just got my keys — what utilities do I need to set up?",
    templateId: 'intent_home_services_new_setup',
    suggestedFollowups: ['How do I register with Irish Water?', 'How do I choose an electricity supplier?']
  },

  // Insurance
  {
    id: 'home_insurance',
    label: 'Home Insurance',
    sector: PillSector.INSURANCE,
    intentKey: 'home.insurance.guidance',
    userVisibleQuestion: 'What should I know about home insurance?',
    templateId: 'intent_home_insurance_guidance',
    suggestedFollowups: ['What types of cover do I need?', 'How do I calculate rebuild cost?']
  }
];

export function getPillsBySector(sector: PillSector): PillDefinition[] {
  return PILL_DEFINITIONS.filter(p => p.sector === sector);
}

export function getPillById(id: string): PillDefinition | undefined {
  return PILL_DEFINITIONS.find(p => p.id === id);
}

export function getPillByIntentKey(intentKey: string): PillDefinition | undefined {
  return PILL_DEFINITIONS.find(p => p.intentKey === intentKey);
}

export function getAllSectors(): PillSector[] {
  return Object.values(PillSector);
}
