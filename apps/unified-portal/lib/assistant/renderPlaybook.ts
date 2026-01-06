/**
 * Playbook Renderer
 * 
 * Renders playbook templates with scheme context injected.
 * Ensures no em dashes in output.
 */

import { 
  PlaybookTemplate, 
  PlaybookSection, 
  SchemeContext,
  getPlaybook,
  PlaybookTopic,
} from './playbook-templates';

export interface RenderOptions {
  includeTitle?: boolean;
  includeClosing?: boolean;
  maxSections?: number;
}

function sanitizeText(text: string): string {
  return text
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/"/g, '"')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/'/g, "'");
}

function interpolate(template: string, context: SchemeContext): string {
  let result = template;
  
  if (template.includes('{{heating_intro}}')) {
    if (context.heating_type === 'heat_pump') {
      result = result.replace('{{heating_intro}}', 
        'Your home is equipped with a heat pump heating system. Heat pumps are efficient and environmentally friendly, but work differently from traditional boilers.');
    } else if (context.heating_type === 'gas_boiler' || context.heating_type === 'oil_boiler') {
      result = result.replace('{{heating_intro}}', 
        `Your home has a ${context.heating_type === 'gas_boiler' ? 'gas' : 'oil'} boiler heating system. Here is guidance on using and maintaining your heating.`);
    } else {
      result = result.replace('{{heating_intro}}', 
        'Understanding your heating system helps you stay comfortable and use energy efficiently. Here is general guidance that applies to most heating systems.');
    }
  }
  
  if (template.includes('{{snag_reporting_intro}}')) {
    if (context.snag_reporting_method === 'email' && context.snag_reporting_details) {
      result = result.replace('{{snag_reporting_intro}}', 
        `Report snags by email to: ${context.snag_reporting_details}`);
    } else if (context.snag_reporting_method === 'portal' && context.snag_reporting_details) {
      result = result.replace('{{snag_reporting_intro}}', 
        `Report snags through the online portal: ${context.snag_reporting_details}`);
    } else if (context.snag_reporting_method === 'phone' && context.snag_reporting_details) {
      result = result.replace('{{snag_reporting_intro}}', 
        `Report snags by phone: ${context.snag_reporting_details}`);
    } else {
      result = result.replace('{{snag_reporting_intro}}', 
        'Contact your developer or management company to submit your snag list. Check your welcome pack for the preferred method.');
    }
  }
  
  if (template.includes('{{snag_closing}}')) {
    if (context.snag_reporting_details) {
      result = result.replace('{{snag_closing}}', 
        `For snag reporting at ${context.scheme_name || 'your development'}, use: ${context.snag_reporting_details}`);
    } else {
      result = result.replace('{{snag_closing}}', 
        'Keep all snag documentation organized and follow up regularly on reported issues.');
    }
  }
  
  if (template.includes('{{emergency_contacts}}')) {
    const contacts: string[] = [];
    
    if (context.emergency_contact_phone) {
      contacts.push(`Estate Emergency Line: ${context.emergency_contact_phone}`);
    }
    if (context.emergency_contact_notes) {
      contacts.push(context.emergency_contact_notes);
    }
    if (context.managing_agent_name && context.contact_phone) {
      contacts.push(`${context.managing_agent_name}: ${context.contact_phone}`);
    }
    
    if (contacts.length > 0) {
      result = result.replace('{{emergency_contacts}}', 
        'Your development contacts:\n' + contacts.map(c => `- ${c}`).join('\n'));
    } else {
      result = result.replace('{{emergency_contacts}}', 
        'For non-life-threatening emergencies, contact your management company or developer during business hours. Keep their contact details accessible.');
    }
  }
  
  if (template.includes('{{bin_storage_notes}}')) {
    if (context.bin_storage_notes) {
      result = result.replace('{{bin_storage_notes}}', context.bin_storage_notes);
    } else if (context.waste_provider) {
      result = result.replace('{{bin_storage_notes}}', 
        `Your waste collection is managed by ${context.waste_provider}. Contact them for specific collection schedules and guidelines.`);
    } else {
      result = result.replace('{{bin_storage_notes}}', 
        'Check your estate signage or welcome pack for bin storage locations and collection schedules.');
    }
  }
  
  if (template.includes('{{parking_notes}}')) {
    if (context.parking_notes) {
      result = result.replace('{{parking_notes}}', context.parking_notes);
    } else if (context.parking_type) {
      const parkingDescriptions: Record<string, string> = {
        'allocated': 'Your development has allocated parking spaces. Check your documentation for your assigned space number.',
        'unallocated': 'Parking is on a first-come, first-served basis. Please be considerate of neighbours.',
        'permit': 'Parking requires a permit. Contact your management company for permit details.',
        'underground': 'Underground parking is available. Check your welcome pack for access details.',
        'on_street': 'On-street parking is available. Check for any local restrictions.',
      };
      result = result.replace('{{parking_notes}}', 
        parkingDescriptions[context.parking_type] || 'Check your welcome pack for parking arrangements.');
    } else {
      result = result.replace('{{parking_notes}}', 
        'For specific parking rules at your development, check your welcome pack or contact your management company.');
    }
  }
  
  result = result.replace(/\{\{[^}]+\}\}/g, '');
  
  return sanitizeText(result);
}

function renderSection(section: PlaybookSection, context: SchemeContext): string {
  const lines: string[] = [];
  
  lines.push(`**${sanitizeText(section.heading)}**`);
  lines.push('');
  
  if (section.content) {
    lines.push(interpolate(section.content, context));
    lines.push('');
  }
  
  if (section.bullets && section.bullets.length > 0) {
    for (const bullet of section.bullets) {
      lines.push(`- ${sanitizeText(bullet)}`);
    }
    lines.push('');
  }
  
  if (section.note) {
    lines.push(`*Note: ${sanitizeText(section.note)}*`);
    lines.push('');
  }
  
  return lines.join('\n');
}

export function renderPlaybook(
  playbook: PlaybookTemplate,
  context: SchemeContext = {},
  options: RenderOptions = {}
): string {
  const {
    includeTitle = true,
    includeClosing = true,
    maxSections,
  } = options;
  
  const lines: string[] = [];
  
  if (includeTitle) {
    lines.push(`## ${sanitizeText(playbook.title)}`);
    lines.push('');
  }
  
  lines.push(interpolate(playbook.intro, context));
  lines.push('');
  
  const sectionsToRender = maxSections 
    ? playbook.sections.slice(0, maxSections) 
    : playbook.sections;
  
  for (const section of sectionsToRender) {
    lines.push(renderSection(section, context));
  }
  
  if (includeClosing && playbook.closing) {
    const closingText = interpolate(playbook.closing, context);
    if (closingText.trim()) {
      lines.push('---');
      lines.push('');
      lines.push(closingText);
    }
  }
  
  return lines.join('\n').trim();
}

export function renderPlaybookByTopic(
  topic: PlaybookTopic,
  context: SchemeContext = {},
  options: RenderOptions = {}
): string | null {
  const playbook = getPlaybook(topic);
  if (!playbook) {
    return null;
  }
  
  return renderPlaybook(playbook, context, options);
}

export function renderPlaybookSection(
  topic: PlaybookTopic,
  sectionHeading: string,
  context: SchemeContext = {}
): string | null {
  const playbook = getPlaybook(topic);
  if (!playbook) {
    return null;
  }
  
  const section = playbook.sections.find(
    s => s.heading.toLowerCase() === sectionHeading.toLowerCase()
  );
  
  if (!section) {
    return null;
  }
  
  return renderSection(section, context);
}

export interface PlaybookResponse {
  topic: PlaybookTopic;
  content: string;
  isGenericFallback: boolean;
  schemeFieldsAvailable: string[];
  schemeFieldsMissing: string[];
}

export function generatePlaybookResponse(
  topic: PlaybookTopic,
  context: SchemeContext = {}
): PlaybookResponse | null {
  const playbook = getPlaybook(topic);
  if (!playbook) {
    return null;
  }
  
  const schemeFieldsAvailable: string[] = [];
  const schemeFieldsMissing: string[] = [];
  
  for (const field of playbook.schemeFieldsUsed || []) {
    const value = context[field as keyof SchemeContext];
    if (value && value !== 'unknown') {
      schemeFieldsAvailable.push(field);
    } else {
      schemeFieldsMissing.push(field);
    }
  }
  
  const content = renderPlaybook(playbook, context);
  
  const isGenericFallback = schemeFieldsAvailable.length === 0 && 
    (playbook.schemeFieldsUsed?.length || 0) > 0;
  
  return {
    topic,
    content,
    isGenericFallback,
    schemeFieldsAvailable,
    schemeFieldsMissing,
  };
}
