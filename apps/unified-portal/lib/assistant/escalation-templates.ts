/**
 * Ireland-specific escalation templates for concierge escalation
 * Provides message templates and guidance when assistant cannot answer confidently
 */

export type EscalationTarget = 'developer' | 'omc' | 'installer' | 'emergency_services' | 'unknown';

export interface EscalationTemplate {
  target: EscalationTarget;
  targetDescription: string;
  messageTemplate: string;
  requiredFields: string[];
  optionalFields: string[];
  disclaimer?: string;
  urgencyLevel: 'low' | 'medium' | 'high' | 'emergency';
}

export const ESCALATION_ROLE_DESCRIPTIONS: Record<EscalationTarget, string> = {
  developer: 'the property developer (builder)',
  omc: 'the Owners Management Company (OMC) or property management agent',
  installer: 'the specialist contractor or installer',
  emergency_services: 'emergency services (999/112)',
  unknown: 'the relevant party',
};

export const ESCALATION_TEMPLATES: Record<string, EscalationTemplate> = {
  structural_defect: {
    target: 'developer',
    targetDescription: 'the property developer',
    messageTemplate: `I've noticed an issue with my property that may require attention from the developer.

**Unit Details:**
- Development: [DEVELOPMENT_NAME]
- Unit/House: [UNIT_NUMBER]
- Block (if applicable): [BLOCK]

**Issue Description:**
[DESCRIBE THE ISSUE IN DETAIL]

**When Noticed:**
[DATE/TIME FIRST NOTICED]

I would appreciate if someone could inspect this at your earliest convenience. Please let me know what times would suit for an inspection.`,
    requiredFields: ['unit_number', 'issue_description'],
    optionalFields: ['block', 'photos', 'preferred_contact_time'],
    urgencyLevel: 'medium',
  },

  snag_warranty: {
    target: 'developer',
    targetDescription: 'the property developer (snagging/warranty team)',
    messageTemplate: `I would like to report a snagging item or warranty issue.

**Unit Details:**
- Development: [DEVELOPMENT_NAME]
- Unit/House: [UNIT_NUMBER]
- Block (if applicable): [BLOCK]

**Snagging Item:**
[DESCRIBE THE ITEM]

**Location in Property:**
[ROOM/AREA]

I have attached photos if available. Please advise on the next steps.`,
    requiredFields: ['unit_number', 'issue_description', 'location'],
    optionalFields: ['photos', 'move_in_date'],
    urgencyLevel: 'low',
  },

  appliance_issue: {
    target: 'installer',
    targetDescription: 'the appliance manufacturer or installer',
    messageTemplate: `I need assistance with an appliance issue.

**Appliance Details:**
- Type: [APPLIANCE_TYPE]
- Model (if known): [MODEL_NUMBER]

**Unit Details:**
- Development: [DEVELOPMENT_NAME]
- Unit/House: [UNIT_NUMBER]

**Issue Description:**
[DESCRIBE THE PROBLEM]

**Has this been happening since move-in?** [YES/NO]

Please advise on whether this is covered under warranty and what steps I should take.`,
    requiredFields: ['appliance_type', 'unit_number', 'issue_description'],
    optionalFields: ['model_number', 'photos', 'error_codes'],
    urgencyLevel: 'medium',
  },

  heat_pump_issue: {
    target: 'installer',
    targetDescription: 'the heat pump installer or Daikin service team',
    messageTemplate: `I'm experiencing an issue with my heat pump system.

**Unit Details:**
- Development: [DEVELOPMENT_NAME]
- Unit/House: [UNIT_NUMBER]

**Issue Description:**
[DESCRIBE THE PROBLEM]

**Error Codes (if any):**
[ANY CODES SHOWN ON DISPLAY OR CONTROLLER]

**Current Settings:**
- Heating mode: [ON/OFF]
- Hot water: [WORKING/NOT WORKING]

Please advise on troubleshooting steps or arrange a service call if needed.`,
    requiredFields: ['unit_number', 'issue_description'],
    optionalFields: ['error_codes', 'photos', 'heating_mode', 'hot_water_status'],
    urgencyLevel: 'medium',
  },

  communal_area: {
    target: 'omc',
    targetDescription: 'the Owners Management Company (OMC) or managing agent',
    messageTemplate: `I would like to report an issue in the communal areas.

**Development:** [DEVELOPMENT_NAME]
**Block (if applicable):** [BLOCK]

**Location:**
[WHERE IN THE COMMUNAL AREA]

**Issue Description:**
[DESCRIBE THE ISSUE]

**Is this urgent/a safety concern?** [YES/NO]

Please let me know when this can be addressed.`,
    requiredFields: ['location', 'issue_description'],
    optionalFields: ['block', 'photos', 'urgency'],
    urgencyLevel: 'low',
  },

  service_charge: {
    target: 'omc',
    targetDescription: 'the Owners Management Company (OMC)',
    messageTemplate: `I have a query regarding service charges/management fees.

**Unit Details:**
- Development: [DEVELOPMENT_NAME]
- Unit/House: [UNIT_NUMBER]

**Query:**
[YOUR QUESTION]

Please provide clarification at your earliest convenience.`,
    requiredFields: ['unit_number', 'query'],
    optionalFields: [],
    urgencyLevel: 'low',
  },

  parking: {
    target: 'omc',
    targetDescription: 'the Owners Management Company (OMC) or managing agent',
    messageTemplate: `I need to raise a parking-related matter.

**Development:** [DEVELOPMENT_NAME]
**Unit/House:** [UNIT_NUMBER]

**Issue:**
[DESCRIBE THE PARKING ISSUE]

Please advise on the process for resolving this.`,
    requiredFields: ['unit_number', 'issue_description'],
    optionalFields: ['car_registration', 'photos'],
    urgencyLevel: 'low',
  },

  ev_charger_issue: {
    target: 'installer',
    targetDescription: 'the EV charger installer or Ohme support',
    messageTemplate: `I'm having an issue with my EV charger.

**Unit Details:**
- Development: [DEVELOPMENT_NAME]
- Unit/House: [UNIT_NUMBER]

**Charger Details:**
- Brand: [OHME/EPOD/OTHER]

**Issue Description:**
[DESCRIBE THE PROBLEM]

**Error Lights/Codes (if any):**
[ANY VISIBLE INDICATORS]

Please advise on troubleshooting or arrange a service visit.`,
    requiredFields: ['unit_number', 'issue_description'],
    optionalFields: ['charger_brand', 'error_codes', 'photos'],
    urgencyLevel: 'medium',
  },

  security_alarm: {
    target: 'installer',
    targetDescription: 'the alarm/security installer',
    messageTemplate: `I need assistance with my security system.

**Unit Details:**
- Development: [DEVELOPMENT_NAME]
- Unit/House: [UNIT_NUMBER]

**Issue Description:**
[DESCRIBE THE PROBLEM]

**Is the alarm currently sounding?** [YES/NO]

Please advise on how to resolve this.`,
    requiredFields: ['unit_number', 'issue_description'],
    optionalFields: ['alarm_brand', 'photos'],
    urgencyLevel: 'medium',
  },

  emergency_gas: {
    target: 'emergency_services',
    targetDescription: 'Gas Networks Ireland emergency line',
    messageTemplate: `If you smell gas or suspect a gas leak:
1. Do NOT use any electrical switches or appliances
2. Open windows and doors
3. Leave the property immediately
4. Call Gas Networks Ireland: 1800 20 50 50 (24/7)
5. Do not re-enter until cleared by a professional`,
    requiredFields: [],
    optionalFields: [],
    disclaimer: 'This is an emergency safety procedure. Call immediately if you suspect a gas leak.',
    urgencyLevel: 'emergency',
  },

  emergency_water: {
    target: 'emergency_services',
    targetDescription: 'Irish Water or emergency services',
    messageTemplate: `For a serious water emergency (burst pipes, major leak):
1. Locate and turn off the mains water stopcock
2. For external supply issues: Irish Water 1800 278 278
3. For internal flooding causing danger: Contact emergency services 999/112
4. For non-emergency leaks: Contact your OMC or developer during office hours`,
    requiredFields: [],
    optionalFields: [],
    disclaimer: 'Turn off water at the mains first to minimize damage.',
    urgencyLevel: 'emergency',
  },

  emergency_electrical: {
    target: 'emergency_services',
    targetDescription: 'ESB Networks emergency line',
    messageTemplate: `For electrical emergencies:
1. Do NOT touch electrical fittings if there's water present
2. Turn off power at the main consumer unit/fuse board if safe
3. ESB Networks (power outages/fallen lines): 1800 372 999
4. For fire: Call 999/112 immediately`,
    requiredFields: [],
    optionalFields: [],
    disclaimer: 'Never attempt electrical repairs yourself. Call a qualified electrician.',
    urgencyLevel: 'emergency',
  },

  general_unknown: {
    target: 'unknown',
    targetDescription: 'the relevant party',
    messageTemplate: `I have a query that I need assistance with.

**Unit Details:**
- Development: [DEVELOPMENT_NAME]
- Unit/House: [UNIT_NUMBER]

**Query:**
[DESCRIBE YOUR QUESTION OR ISSUE]

Please advise on who I should contact and how to proceed.`,
    requiredFields: ['issue_description'],
    optionalFields: ['unit_number', 'photos'],
    urgencyLevel: 'low',
  },
};

export const FALLBACK_CONTACT_GUIDANCE: Record<EscalationTarget, string> = {
  developer: 'Contact the developer using the details provided in your welcome pack or purchase documentation. If you don\'t have these to hand, your solicitor may be able to provide them.',
  omc: 'Contact the Owners Management Company (OMC) or managing agent. Their contact details should be in your welcome pack, or displayed in the communal areas of your building.',
  installer: 'The installer\'s contact details may be on the appliance warranty card or in your home manual. If not available, contact the developer who can direct you to the correct contractor.',
  emergency_services: 'For emergencies, call 999 or 112. For utility emergencies: Gas Networks Ireland (1800 20 50 50), ESB Networks (1800 372 999), Irish Water (1800 278 278).',
  unknown: 'Check your welcome pack or home manual for contact details. The developer or OMC should be able to direct you to the appropriate party.',
};

export function getTemplateForIssueType(issueType: string): EscalationTemplate {
  const normalizedIssue = issueType.toLowerCase().replace(/[_\s-]+/g, '_');
  
  if (normalizedIssue.includes('gas') && (normalizedIssue.includes('leak') || normalizedIssue.includes('smell'))) {
    return ESCALATION_TEMPLATES.emergency_gas;
  }
  if (normalizedIssue.includes('flood') || (normalizedIssue.includes('water') && normalizedIssue.includes('emergency'))) {
    return ESCALATION_TEMPLATES.emergency_water;
  }
  if (normalizedIssue.includes('electr') && (normalizedIssue.includes('fire') || normalizedIssue.includes('shock'))) {
    return ESCALATION_TEMPLATES.emergency_electrical;
  }
  
  if (normalizedIssue.includes('heat_pump') || normalizedIssue.includes('daikin') || normalizedIssue.includes('heating_system')) {
    return ESCALATION_TEMPLATES.heat_pump_issue;
  }
  if (normalizedIssue.includes('ev') || normalizedIssue.includes('charger') || normalizedIssue.includes('ohme') || normalizedIssue.includes('epod')) {
    return ESCALATION_TEMPLATES.ev_charger_issue;
  }
  if (normalizedIssue.includes('alarm') || normalizedIssue.includes('security')) {
    return ESCALATION_TEMPLATES.security_alarm;
  }
  if (normalizedIssue.includes('appliance') || normalizedIssue.includes('oven') || normalizedIssue.includes('dishwasher') || normalizedIssue.includes('washing')) {
    return ESCALATION_TEMPLATES.appliance_issue;
  }
  
  if (normalizedIssue.includes('snag') || normalizedIssue.includes('warranty') || normalizedIssue.includes('defect')) {
    return ESCALATION_TEMPLATES.snag_warranty;
  }
  if (normalizedIssue.includes('structur') || normalizedIssue.includes('crack') || normalizedIssue.includes('damp')) {
    return ESCALATION_TEMPLATES.structural_defect;
  }
  
  if (normalizedIssue.includes('communal') || normalizedIssue.includes('common_area') || normalizedIssue.includes('shared')) {
    return ESCALATION_TEMPLATES.communal_area;
  }
  if (normalizedIssue.includes('service_charge') || normalizedIssue.includes('management_fee')) {
    return ESCALATION_TEMPLATES.service_charge;
  }
  if (normalizedIssue.includes('parking') || normalizedIssue.includes('car_park')) {
    return ESCALATION_TEMPLATES.parking;
  }
  
  return ESCALATION_TEMPLATES.general_unknown;
}
