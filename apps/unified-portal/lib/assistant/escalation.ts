/**
 * Concierge Escalation Router
 * Routes users to the correct party when assistant cannot answer confidently
 * NEVER hallucinated contact details - only uses scheme-provided contacts or generic guidance
 */

import {
  EscalationTarget,
  EscalationTemplate,
  ESCALATION_ROLE_DESCRIPTIONS,
  FALLBACK_CONTACT_GUIDANCE,
  getTemplateForIssueType,
} from './escalation-templates';
import { sanitizeForChat } from './formatting';

export interface SchemeContacts {
  developer?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  omc?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  installers?: Record<string, {
    name?: string;
    email?: string;
    phone?: string;
    specialty?: string;
  }>;
}

export interface EscalationInput {
  intent: string;
  confidence: 'high' | 'medium' | 'low' | 'none';
  gapReason?: string;
  schemeContacts?: SchemeContacts;
  sessionContext?: {
    block?: string;
    unitNumber?: string;
    developmentName?: string;
    issueType?: string;
  };
}

export interface EscalationOutput {
  escalationTarget: EscalationTarget;
  targetDescription: string;
  messageTemplate: string;
  requiredFields: string[];
  contactInfo: string | null;
  disclaimer: string | null;
  urgencyLevel: 'low' | 'medium' | 'high' | 'emergency';
}

const ESCALATION_FEATURE_FLAG = 'ASSISTANT_CONCIERGE_ESCALATION';

export function isEscalationEnabled(): boolean {
  return process.env[ESCALATION_FEATURE_FLAG] === 'true';
}

const ESCALATION_ALLOWED_INTENTS = [
  'snagging',
  'snag',
  'warranty',
  'warranties',
  'defect',
  'defects',
  'emergency',
  'emergencies',
  'utilities_setup',
  'utilities',
  'management_company',
  'omc',
  'management',
  'payments',
  'fees',
  'service_charge',
  'heat_pump',
  'ev_charger',
  'appliance',
  'alarm',
  'solar',
  'ventilation',
  'mvhr',
  'structural',
  'construction',
  'gas_leak',
  'fire',
  'flood',
  'water_leak',
];

const ESCALATION_BLOCKED_INTENTS = [
  'area_trivia',
  'local_area_fact',
  'local_history',
  'amenities',
  'nearby_places',
  'general_chat',
  'chit_chat',
  'greeting',
  'thanks',
  'goodbye',
  'did_you_know',
  'restaurants',
  'cafes',
  'shops',
  'schools',
  'transport',
];

export function isEscalationAllowedForIntent(intent: string): boolean {
  const normalizedIntent = intent.toLowerCase();
  
  if (ESCALATION_BLOCKED_INTENTS.some(blocked => normalizedIntent.includes(blocked))) {
    return false;
  }
  
  return ESCALATION_ALLOWED_INTENTS.some(allowed => normalizedIntent.includes(allowed));
}

export function shouldTriggerEscalation(confidence: string, gapReason?: string, intent?: string): boolean {
  if (intent && !isEscalationAllowedForIntent(intent)) {
    return false;
  }
  
  const lowConfidenceReasons = [
    'missing_scheme_data',
    'no_documents_found',
    'low_doc_confidence',
    'validation_failed',
    'no_relevant_chunks',
  ];
  
  if (confidence === 'low' || confidence === 'none') {
    return true;
  }
  
  if (gapReason && lowConfidenceReasons.includes(gapReason)) {
    return true;
  }
  
  return false;
}

function determineEscalationTarget(intent: string, issueType?: string): EscalationTarget {
  const normalizedIntent = intent.toLowerCase();
  
  if (normalizedIntent.includes('gas') || normalizedIntent.includes('fire') || 
      normalizedIntent.includes('flood') || normalizedIntent.includes('emergency')) {
    return 'emergency_services';
  }
  
  if (normalizedIntent.includes('heat_pump') || normalizedIntent.includes('ev_charger') ||
      normalizedIntent.includes('appliance') || normalizedIntent.includes('alarm') ||
      normalizedIntent.includes('solar') || normalizedIntent.includes('ventilation') ||
      normalizedIntent.includes('mvhr') || normalizedIntent.includes('daikin') ||
      normalizedIntent.includes('ohme')) {
    return 'installer';
  }
  
  if (normalizedIntent.includes('snag') || normalizedIntent.includes('warranty') ||
      normalizedIntent.includes('defect') || normalizedIntent.includes('structural') ||
      normalizedIntent.includes('construction')) {
    return 'developer';
  }
  
  if (normalizedIntent.includes('service_charge') || normalizedIntent.includes('communal') ||
      normalizedIntent.includes('parking') || normalizedIntent.includes('management') ||
      normalizedIntent.includes('common_area') || normalizedIntent.includes('bin') ||
      normalizedIntent.includes('lift') || normalizedIntent.includes('entrance')) {
    return 'omc';
  }
  
  if (issueType) {
    const template = getTemplateForIssueType(issueType);
    return template.target;
  }
  
  return 'unknown';
}

function buildContactInfo(target: EscalationTarget, schemeContacts?: SchemeContacts): string | null {
  if (!schemeContacts) {
    return null;
  }
  
  switch (target) {
    case 'developer':
      if (schemeContacts.developer) {
        const dev = schemeContacts.developer;
        const parts: string[] = [];
        if (dev.name) parts.push(dev.name);
        if (dev.email) parts.push(`Email: ${dev.email}`);
        if (dev.phone) parts.push(`Phone: ${dev.phone}`);
        return parts.length > 0 ? parts.join('\n') : null;
      }
      break;
      
    case 'omc':
      if (schemeContacts.omc) {
        const omc = schemeContacts.omc;
        const parts: string[] = [];
        if (omc.name) parts.push(omc.name);
        if (omc.email) parts.push(`Email: ${omc.email}`);
        if (omc.phone) parts.push(`Phone: ${omc.phone}`);
        return parts.length > 0 ? parts.join('\n') : null;
      }
      break;
      
    case 'installer':
      if (schemeContacts.installers) {
        const installers = Object.values(schemeContacts.installers);
        if (installers.length === 1) {
          const installer = installers[0];
          const parts: string[] = [];
          if (installer.name) parts.push(installer.name);
          if (installer.specialty) parts.push(`(${installer.specialty})`);
          if (installer.email) parts.push(`Email: ${installer.email}`);
          if (installer.phone) parts.push(`Phone: ${installer.phone}`);
          return parts.length > 0 ? parts.join('\n') : null;
        }
      }
      break;
      
    case 'emergency_services':
      return null;
  }
  
  return null;
}

function personalizeTemplate(
  template: string,
  context?: EscalationInput['sessionContext']
): string {
  if (!context) return template;
  
  let result = template;
  
  if (context.developmentName) {
    result = result.replace(/\[DEVELOPMENT_NAME\]/g, context.developmentName);
  }
  if (context.unitNumber) {
    result = result.replace(/\[UNIT_NUMBER\]/g, context.unitNumber);
    result = result.replace(/\[UNIT\/HOUSE\]/g, context.unitNumber);
  }
  if (context.block) {
    result = result.replace(/\[BLOCK\]/g, context.block);
  }
  
  return result;
}

export function routeEscalation(input: EscalationInput): EscalationOutput {
  const target = determineEscalationTarget(input.intent, input.sessionContext?.issueType);
  const template = getTemplateForIssueType(input.sessionContext?.issueType || input.intent);
  
  const personalizedMessage = personalizeTemplate(template.messageTemplate, input.sessionContext);
  const contactInfo = buildContactInfo(target, input.schemeContacts);
  
  return {
    escalationTarget: target,
    targetDescription: template.targetDescription || ESCALATION_ROLE_DESCRIPTIONS[target],
    messageTemplate: personalizedMessage,
    requiredFields: template.requiredFields,
    contactInfo,
    disclaimer: template.disclaimer || null,
    urgencyLevel: template.urgencyLevel,
  };
}

const FORBIDDEN_PLACEHOLDER_TOKENS = [
  'relevant party',
  'appropriate party',
  'the party',
  '[CONTACT]',
  '[NAME]',
  '[EMAIL]',
  '[PHONE]',
  '[ADDRESS]',
  'contact the relevant',
  'reach out to the relevant',
  'speak to the relevant',
];

function containsForbiddenPlaceholders(text: string): boolean {
  const lowerText = text.toLowerCase();
  return FORBIDDEN_PLACEHOLDER_TOKENS.some(token => lowerText.includes(token.toLowerCase()));
}

const SAFE_FALLBACK_RESPONSE = "I don't have the specific contact details for this. You can usually find the right contact in your welcome pack or development documentation.";

export function formatEscalationGuidance(escalation: EscalationOutput): string | null {
  if (escalation.escalationTarget === 'unknown') {
    return null;
  }
  
  const lines: string[] = [];
  
  if (escalation.urgencyLevel === 'emergency') {
    lines.push('IMPORTANT SAFETY INFORMATION:');
    lines.push('');
    lines.push(escalation.messageTemplate);
    if (escalation.disclaimer) {
      lines.push('');
      lines.push(`Note: ${escalation.disclaimer}`);
    }
    const result = lines.join('\n');
    if (containsForbiddenPlaceholders(result)) {
      return null;
    }
    return sanitizeForChat(result);
  }
  
  lines.push(`For this matter, I'd recommend contacting ${escalation.targetDescription}.`);
  lines.push('');
  
  if (escalation.contactInfo) {
    lines.push('Contact Details:');
    lines.push(escalation.contactInfo);
    lines.push('');
  } else {
    lines.push(FALLBACK_CONTACT_GUIDANCE[escalation.escalationTarget]);
    lines.push('');
  }
  
  lines.push('What to include in your message:');
  const allFields = [...escalation.requiredFields];
  const fieldDescriptions: Record<string, string> = {
    unit_number: 'Your unit/house number',
    issue_description: 'A clear description of the issue',
    location: 'Where in the property the issue is located',
    block: 'Your block name/number (if applicable)',
    photos: 'Photos of the issue (if possible)',
    preferred_contact_time: 'Your preferred contact time',
    appliance_type: 'The type of appliance affected',
    model_number: 'The model number (usually on a label)',
    error_codes: 'Any error codes displayed',
    query: 'Your specific question',
  };
  
  for (const field of allFields) {
    const description = fieldDescriptions[field] || field.replace(/_/g, ' ');
    lines.push(`- ${description}`);
  }
  
  if (escalation.disclaimer) {
    lines.push('');
    lines.push(`Note: ${escalation.disclaimer}`);
  }
  
  lines.push('');
  lines.push('Sample message you can use:');
  lines.push('');
  lines.push('```');
  lines.push(escalation.messageTemplate);
  lines.push('```');
  
  const result = lines.join('\n');
  
  if (containsForbiddenPlaceholders(result)) {
    console.warn('[Escalation] Blocked output containing forbidden placeholder tokens');
    return null;
  }
  
  return sanitizeForChat(result);
}

export { containsForbiddenPlaceholders, SAFE_FALLBACK_RESPONSE };

export function appendEscalationToResponse(
  response: string,
  escalation: EscalationOutput,
  intent?: string
): string {
  if (intent && !isEscalationAllowedForIntent(intent)) {
    return response;
  }
  
  const guidance = formatEscalationGuidance(escalation);
  
  if (!guidance) {
    return response;
  }
  
  const cleanResponse = response.trim();
  const separator = cleanResponse.endsWith('?') || cleanResponse.endsWith('.') || cleanResponse.endsWith('!') 
    ? '\n\n' 
    : ' \n\n';
  
  return `${cleanResponse}${separator}How to get further help:\n\n${guidance}`;
}

export function createEscalationForGapReason(
  gapReason: string,
  intent: string,
  sessionContext?: EscalationInput['sessionContext'],
  schemeContacts?: SchemeContacts
): EscalationOutput | null {
  if (!isEscalationEnabled()) {
    return null;
  }
  
  if (!isEscalationAllowedForIntent(intent)) {
    console.log('[Escalation] Blocked for non-actionable intent:', intent);
    return null;
  }
  
  if (!shouldTriggerEscalation('low', gapReason, intent)) {
    return null;
  }
  
  return routeEscalation({
    intent,
    confidence: 'low',
    gapReason,
    schemeContacts,
    sessionContext,
  });
}
