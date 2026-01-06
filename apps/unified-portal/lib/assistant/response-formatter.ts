/**
 * Response Formatter
 * 
 * Handles source transparency, confidence-weighted language, 
 * and related question suggestions for assistant responses.
 * 
 * All upgrades are behind ASSISTANT_UX_ENHANCEMENTS feature flag.
 */

export type SourceType = 
  | 'scheme_profile'
  | 'unit_profile'
  | 'smart_archive'
  | 'google_places'
  | 'playbook'
  | 'escalation'
  | 'unknown';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface FormatterOptions {
  source: SourceType;
  confidence?: number;
  intentType?: string;
  isSensitive?: boolean;
  isEmergency?: boolean;
  placesLastUpdated?: Date;
}

const SOURCE_LABELS: Record<SourceType, string> = {
  scheme_profile: 'Based on the development information provided',
  unit_profile: 'Based on your home\'s details',
  smart_archive: 'Based on your homeowner documentation',
  google_places: 'Based on nearby amenities',
  playbook: 'General guidance',
  escalation: '',
  unknown: '',
};

const RELATED_QUESTIONS: Record<string, string[]> = {
  location_amenities: [
    'What other shops or services are nearby?',
    'Are there any parks or recreational areas close by?',
  ],
  heating: [
    'How can I improve my heating efficiency?',
    'Where can I find information about my heating controls?',
  ],
  waste: [
    'What items cannot go in the recycling bin?',
    'Where is the bin storage area located?',
  ],
  parking: [
    'How do visitors park when visiting me?',
    'Are there any parking permits required?',
  ],
  utilities: [
    'How do I find my MPRN or GPRN?',
    'What should I do if I have a power outage?',
  ],
  snagging: [
    'How long do I have to report snags?',
    'What is not considered a snag?',
  ],
  warranties: [
    'What is covered under my home warranty?',
    'How do I make a warranty claim?',
  ],
};

const SENSITIVE_INTENTS = ['emergencies', 'safety', 'legal', 'complaint'];

export function isUxEnhancementsEnabled(): boolean {
  return process.env.ASSISTANT_UX_ENHANCEMENTS === 'true';
}

export function getConfidenceLevel(confidence?: number): ConfidenceLevel {
  if (confidence === undefined || confidence === null) return 'medium';
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

export function formatSourceHint(options: FormatterOptions): string {
  if (!isUxEnhancementsEnabled()) return '';
  
  const { source, placesLastUpdated } = options;
  
  if (source === 'escalation' || source === 'unknown') return '';
  
  let label = SOURCE_LABELS[source] || '';
  
  if (source === 'google_places' && placesLastUpdated) {
    const dateStr = placesLastUpdated.toLocaleDateString('en-IE', {
      month: 'short',
      year: 'numeric',
    });
    label = `Based on nearby amenities (last updated ${dateStr})`;
  }
  
  return label;
}

export function wrapWithConfidenceLanguage(
  content: string,
  options: FormatterOptions
): string {
  if (!isUxEnhancementsEnabled()) return content;
  
  const level = getConfidenceLevel(options.confidence);
  
  if (level === 'high') {
    return content;
  }
  
  if (level === 'medium') {
    if (!content.toLowerCase().startsWith('based on')) {
      return `Based on the information available, ${content.charAt(0).toLowerCase()}${content.slice(1)}`;
    }
    return content;
  }
  
  if (!content.toLowerCase().startsWith('in most') && 
      !content.toLowerCase().startsWith('generally') &&
      !content.toLowerCase().startsWith('typically')) {
    return `In most developments, ${content.charAt(0).toLowerCase()}${content.slice(1)}`;
  }
  
  return content;
}

export function getRelatedQuestions(options: FormatterOptions): string[] {
  if (!isUxEnhancementsEnabled()) return [];
  
  const { intentType, isSensitive, isEmergency } = options;
  
  if (isSensitive || isEmergency) return [];
  if (!intentType) return [];
  
  if (SENSITIVE_INTENTS.includes(intentType)) return [];
  
  const questions = RELATED_QUESTIONS[intentType];
  if (!questions || questions.length === 0) return [];
  
  return questions.slice(0, 2);
}

export function sanitizeEmDashes(text: string): string {
  return text.replace(/—/g, ' - ').replace(/–/g, '-');
}

export interface FormattedResponse {
  answer: string;
  sourceHint: string;
  relatedQuestions: string[];
}

export function formatAssistantResponse(
  rawAnswer: string,
  options: FormatterOptions
): FormattedResponse {
  let answer = sanitizeEmDashes(rawAnswer);
  
  if (isUxEnhancementsEnabled()) {
    answer = wrapWithConfidenceLanguage(answer, options);
  }
  
  const sourceHint = formatSourceHint(options);
  const relatedQuestions = getRelatedQuestions(options);
  
  return {
    answer,
    sourceHint,
    relatedQuestions,
  };
}

export function renderFormattedResponse(formatted: FormattedResponse): string {
  let output = formatted.answer;
  
  if (formatted.sourceHint) {
    output += `\n\n_${formatted.sourceHint}._`;
  }
  
  if (formatted.relatedQuestions.length > 0) {
    output += '\n\n**You might also want to ask:**';
    for (const q of formatted.relatedQuestions) {
      output += `\n- ${q}`;
    }
  }
  
  return output;
}
