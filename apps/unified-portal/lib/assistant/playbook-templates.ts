/**
 * Playbooks Library
 * 
 * Deterministic, high-value fallback responses for when scheme/unit facts
 * and documents are unavailable. Ensures the assistant remains useful
 * without hallucinating.
 */

export type PlaybookTopic = 
  | 'utilities_setup'
  | 'waste_recycling'
  | 'parking'
  | 'heating_principles'
  | 'snagging_process'
  | 'warranties'
  | 'emergencies';

export interface PlaybookSection {
  heading: string;
  content: string;
  bullets?: string[];
  note?: string;
}

export interface PlaybookTemplate {
  topic: PlaybookTopic;
  title: string;
  intro: string;
  sections: PlaybookSection[];
  closing?: string;
  schemeFieldsUsed?: string[];
}

export interface SchemeContext {
  scheme_name?: string | null;
  managing_agent_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_notes?: string | null;
  heating_type?: string | null;
  heating_controls?: string | null;
  waste_provider?: string | null;
  bin_storage_notes?: string | null;
  parking_type?: string | null;
  parking_notes?: string | null;
  snag_reporting_method?: string | null;
  snag_reporting_details?: string | null;
}

export const PLAYBOOKS: Record<PlaybookTopic, PlaybookTemplate> = {
  utilities_setup: {
    topic: 'utilities_setup',
    title: 'Setting Up Your Utilities',
    intro: 'Moving into a new home involves setting up your electricity, gas, and water accounts. Here is a general guide to help you get started.',
    sections: [
      {
        heading: 'Electricity',
        content: 'You will need your MPRN (Meter Point Reference Number) to set up your electricity account. This is a unique 11-digit number for your property.',
        bullets: [
          'Find your MPRN on your meter, in your welcome pack, or by contacting ESB Networks',
          'Choose an electricity supplier and provide them with your MPRN and move-in date',
          'Take a meter reading on your move-in date and keep a photo as proof',
          'Your "date of responsibility" begins on your move-in date'
        ],
        note: 'Contact ESB Networks at 1800 372 757 if you cannot locate your MPRN.'
      },
      {
        heading: 'Gas',
        content: 'You will need your GPRN (Gas Point Reference Number) to set up your gas account. This is a unique 7-digit number for your property.',
        bullets: [
          'Find your GPRN on your gas meter or by contacting Gas Networks Ireland',
          'Choose a gas supplier and provide them with your GPRN and move-in date',
          'Take a meter reading on your move-in date and keep a photo as proof',
          'Ensure your boiler has been commissioned before using the heating system'
        ],
        note: 'Contact Gas Networks Ireland at 1800 464 464 for GPRN queries.'
      },
      {
        heading: 'Water',
        content: 'Water services in Ireland are managed by Irish Water. Most new homes are already connected.',
        bullets: [
          'Register your property with Irish Water online or by phone',
          'Provide your Eircode and move-in date',
          'Water charges may apply depending on your usage and property type',
          'Report any leaks or water quality issues to Irish Water immediately'
        ],
        note: 'Contact Irish Water at 1800 278 278 for registration and queries.'
      }
    ],
    closing: 'Keep all confirmation emails and reference numbers safe. These will be useful if any issues arise with your utility accounts.',
    schemeFieldsUsed: []
  },

  waste_recycling: {
    topic: 'waste_recycling',
    title: 'Waste Collection and Recycling',
    intro: 'Proper waste management is important for keeping your estate clean and sustainable. Here is general guidance on waste collection.',
    sections: [
      {
        heading: 'Finding Your Collection Schedule',
        content: 'Waste collection schedules vary by location and provider. To find your specific schedule:',
        bullets: [
          'Check for bin labels or stickers that indicate collection days',
          'Look for estate signage near bin storage areas',
          'Contact your local council or waste provider directly',
          'Many councils publish collection calendars online by Eircode'
        ]
      },
      {
        heading: 'Bin Types and Usage',
        content: 'Most areas use a three-bin system. Check your bin labels for specific instructions.',
        bullets: [
          'Green/Brown bin: Organic waste, food scraps, garden waste',
          'Blue/Green bin: Recyclables such as paper, cardboard, plastic bottles, tins',
          'Black/Grey bin: General waste that cannot be recycled'
        ],
        note: 'Bin colours may vary by provider. Always check the labels on your specific bins.'
      },
      {
        heading: 'Common Recycling Exclusions',
        content: 'These items typically cannot go in your recycling bin:',
        bullets: [
          'Soft plastics (bags, wrappers, film)',
          'Food-contaminated packaging',
          'Nappies and sanitary products',
          'Textiles and clothing',
          'Batteries and electronics',
          'Glass (check if glass collection is separate in your area)'
        ],
        note: 'Rules vary by area. When in doubt, check with your waste provider or place items in general waste.'
      }
    ],
    closing: '{{bin_storage_notes}}',
    schemeFieldsUsed: ['waste_provider', 'bin_storage_notes']
  },

  parking: {
    topic: 'parking',
    title: 'Parking Information',
    intro: 'Parking arrangements vary between developments. Here is general guidance to help you understand typical parking setups.',
    sections: [
      {
        heading: 'Finding Your Allocated Space',
        content: 'If your property includes an allocated parking space, you can confirm your allocation by:',
        bullets: [
          'Checking your property purchase documents or lease',
          'Reviewing the site plan in your welcome pack',
          'Contacting your management company or developer',
          'Looking for numbered or labelled spaces near your home'
        ]
      },
      {
        heading: 'Visitor Parking',
        content: 'Visitor parking arrangements vary by development. General guidance:',
        bullets: [
          'Look for designated visitor spaces, often marked with signage',
          'Avoid blocking driveways, fire lanes, or access routes',
          'Some developments require visitor permits or have time limits',
          'Check estate rules for overnight visitor parking policies'
        ]
      },
      {
        heading: 'General Parking Etiquette',
        content: 'To maintain good relations with neighbours:',
        bullets: [
          'Park only in your designated space or visitor areas',
          'Do not block access for emergency vehicles or deliveries',
          'Report abandoned vehicles to your management company',
          'Electric vehicle charging may have specific rules if available'
        ]
      }
    ],
    closing: '{{parking_notes}}',
    schemeFieldsUsed: ['parking_type', 'parking_notes']
  },

  heating_principles: {
    topic: 'heating_principles',
    title: 'Heating Your Home',
    intro: '{{heating_intro}}',
    sections: [
      {
        heading: 'Heat Pump Systems',
        content: 'Heat pumps work differently from traditional boilers and are highly efficient when used correctly.',
        bullets: [
          'Heat pumps work best at lower temperatures run for longer periods',
          'Avoid frequently turning the system on and off',
          'Use your thermostat to set a comfortable temperature and leave it',
          'Heat pumps may take longer to warm your home initially',
          'Ensure all vents and radiators are unobstructed'
        ],
        note: 'Refer to your heat pump manual for specific operating instructions and settings.'
      },
      {
        heading: 'Gas or Oil Boiler Systems',
        content: 'Traditional boilers provide hot water and heating through radiators.',
        bullets: [
          'Learn how to use your thermostat and timer controls',
          'Bleed radiators if you notice cold spots at the top',
          'Check your boiler pressure periodically (typically 1-1.5 bar when cold)',
          'Know the location of your boiler and hot water tank'
        ],
        note: 'Annual servicing is recommended. Check your documentation for warranty requirements.'
      },
      {
        heading: 'General Tips',
        content: 'Regardless of your heating system:',
        bullets: [
          'Keep external doors and windows closed when heating is on',
          'Use curtains and blinds to retain heat in winter',
          'Report any unusual noises, smells, or performance issues promptly',
          'Locate your heating controls and learn the basic functions'
        ]
      }
    ],
    closing: 'For specific settings and maintenance schedules, please refer to your heating system manual or contact a qualified technician.',
    schemeFieldsUsed: ['heating_type', 'heating_controls']
  },

  snagging_process: {
    topic: 'snagging_process',
    title: 'Reporting Snags and Defects',
    intro: 'Snagging refers to minor defects or unfinished work that may be present when you move into a new home. Here is guidance on how to document and report snags effectively.',
    sections: [
      {
        heading: 'Documenting Snags',
        content: 'Good documentation is essential for effective snagging:',
        bullets: [
          'Walk through each room systematically and note any issues',
          'Take clear photos of each defect with good lighting',
          'Include context photos showing the location within the room',
          'Note the date and time each photo was taken',
          'Create a written list with room, description, and priority'
        ]
      },
      {
        heading: 'Common Snag Categories',
        content: 'Issues to look for during your inspection:',
        bullets: [
          'Paintwork: drips, missed spots, poor finish',
          'Joinery: doors not closing properly, scratched surfaces',
          'Fixtures: loose handles, faulty locks, damaged fittings',
          'Walls and ceilings: cracks, uneven plaster, marks',
          'Flooring: scratches, gaps, uneven surfaces',
          'External: incomplete landscaping, drainage issues'
        ]
      },
      {
        heading: 'Reporting Process',
        content: '{{snag_reporting_intro}}',
        bullets: [
          'Submit your snag list as early as possible, ideally at handover',
          'Keep copies of all correspondence and submissions',
          'Follow up in writing if repairs are not scheduled promptly',
          'Take photos before and after repairs are completed'
        ]
      },
      {
        heading: 'Escalation',
        content: 'If snags are not addressed in a reasonable timeframe:',
        bullets: [
          'Send a formal written reminder with your original list',
          'Contact your solicitor if contractual obligations are not being met',
          'Keep records of all communications for potential disputes',
          'Consider independent snagging inspection reports as evidence'
        ],
        note: 'Resolution timeframes depend on the nature and severity of defects. No specific timelines can be guaranteed.'
      }
    ],
    closing: '{{snag_closing}}',
    schemeFieldsUsed: ['snag_reporting_method', 'snag_reporting_details']
  },

  warranties: {
    topic: 'warranties',
    title: 'Understanding Your Warranties',
    intro: 'New homes typically come with various warranties covering different aspects of the property. Here is general guidance on warranty types.',
    sections: [
      {
        heading: 'Structural Warranty',
        content: 'Most new homes in Ireland come with a structural warranty (often called homebond or similar):',
        bullets: [
          'Covers major structural defects in the building',
          'Typically provides protection for a number of years from completion',
          'Claims are made through your warranty provider, not the developer',
          'Keep your warranty documents safe and accessible'
        ],
        note: 'Check your specific warranty documentation for coverage details and claim procedures.'
      },
      {
        heading: 'Appliance Warranties',
        content: 'Individual appliances have their own manufacturer warranties:',
        bullets: [
          'Register each appliance with the manufacturer for warranty activation',
          'Keep receipts and warranty cards in a safe place',
          'Contact the manufacturer directly for appliance issues',
          'These warranties are separate from your home structural warranty'
        ]
      },
      {
        heading: 'Developer Defects vs Appliance Issues',
        content: 'Understanding who to contact:',
        bullets: [
          'Building defects (structure, finishes, fittings): Contact developer or management company',
          'Appliance faults (boiler, hob, oven): Contact appliance manufacturer',
          'If unsure, start with your developer and they can advise',
          'Document issues clearly regardless of who you contact'
        ]
      }
    ],
    closing: 'For specific warranty periods and coverage details, refer to your purchase documentation or contact your developer directly.',
    schemeFieldsUsed: []
  },

  emergencies: {
    topic: 'emergencies',
    title: 'Handling Emergencies',
    intro: 'Knowing how to respond to emergencies can prevent damage and keep you safe. Here is guidance on handling common household emergencies.',
    sections: [
      {
        heading: 'Immediate Danger',
        content: 'For life-threatening emergencies, always call 999 or 112 first.',
        bullets: [
          'Fire: Evacuate immediately and call emergency services',
          'Gas smell: Do not use switches, open windows, evacuate, call Gas Networks Ireland (1800 205 050)',
          'Carbon monoxide alarm: Evacuate and call emergency services',
          'Flooding from mains: Turn off water at the stopcock if safe to do so'
        ],
        note: 'Never put yourself at risk. Evacuate first, then call for help.'
      },
      {
        heading: 'Water Leaks',
        content: 'For non-emergency water issues:',
        bullets: [
          'Locate and turn off the stopcock (usually under the kitchen sink or in a utility area)',
          'Turn off the water heater or boiler if the leak involves hot water',
          'Contain the water with towels and buckets',
          'Take photos for your records',
          'Contact a plumber or your emergency contact'
        ]
      },
      {
        heading: 'Power Outage',
        content: 'If you lose electricity:',
        bullets: [
          'Check if the outage affects your whole area or just your home',
          'Check your consumer unit (fuse board) for tripped switches',
          'If a switch keeps tripping, do not force it and call an electrician',
          'For area outages, check ESB Networks outage map or call 1800 372 999'
        ]
      },
      {
        heading: 'Heating Failure',
        content: 'If your heating stops working:',
        bullets: [
          'Check the thermostat settings and timer',
          'Check the boiler display for error codes',
          'Ensure the gas or electricity supply is connected',
          'Check boiler pressure gauge if applicable',
          'Contact a heating engineer if basic checks do not resolve the issue'
        ]
      },
      {
        heading: 'Emergency Contacts',
        content: '{{emergency_contacts}}'
      }
    ],
    closing: 'Keep a list of emergency contacts accessible. Many issues can be prevented or minimized with prompt action.',
    schemeFieldsUsed: ['emergency_contact_phone', 'emergency_contact_notes', 'managing_agent_name', 'contact_phone']
  }
};

export function getPlaybook(topic: PlaybookTopic): PlaybookTemplate | null {
  return PLAYBOOKS[topic] || null;
}

export function getAllPlaybooks(): PlaybookTemplate[] {
  return Object.values(PLAYBOOKS);
}

export function detectPlaybookTopic(query: string): PlaybookTopic | null {
  const lower = query.toLowerCase();
  
  const patterns: [RegExp, PlaybookTopic][] = [
    [/\b(utilit|electric|gas|water|mprn|gprn|meter|esb|irish\s*water|supplier)\b/i, 'utilities_setup'],
    [/\b(bin|waste|recycl|rubbish|collection|garbage|compost)\b/i, 'waste_recycling'],
    [/\b(park|car\s*space|visitor\s*park|allocated|garage)\b/i, 'parking'],
    [/\b(heat|boiler|thermostat|radiator|warm|cold|temperature|heat\s*pump)\b/i, 'heating_principles'],
    [/\b(snag|defect|punch|issue|problem|finish|paint|door|window)\b/i, 'snagging_process'],
    [/\b(warrant|guarant|coverage|claim|homebond|appliance\s*cover)\b/i, 'warranties'],
    [/\b(emergenc|urgent|leak|flood|fire|gas\s*smell|power\s*out|no\s*heat)\b/i, 'emergencies'],
  ];
  
  for (const [pattern, topic] of patterns) {
    if (pattern.test(lower)) {
      return topic;
    }
  }
  
  return null;
}
