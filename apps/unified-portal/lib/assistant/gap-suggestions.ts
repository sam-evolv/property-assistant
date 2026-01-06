/**
 * Gap-to-Action Suggestions
 * 
 * Generates suggested remediation actions based on gap_reason
 * to help developers improve their scheme data and documents.
 */

import { GapReason } from './gap-logger';

export interface GapSuggestion {
  action: string;
  field?: string;
  category?: string;
  priority: 'high' | 'medium' | 'low';
}

const SCHEME_FIELD_SUGGESTIONS: Record<string, string> = {
  heating: 'heating_type, heating_controls',
  waste: 'waste_provider, bin_storage_notes',
  parking: 'parking_type, parking_notes',
  utilities: 'utility_notes',
  snagging: 'snag_reporting_method, snag_reporting_details',
  emergencies: 'emergency_contact_phone, emergency_contact_notes',
  location_amenities: 'latitude, longitude (for nearby places)',
  general: 'managing_agent_name, contact_email, contact_phone',
};

const DOC_CATEGORY_SUGGESTIONS: Record<string, string[]> = {
  heating: ['Heating Guide', 'Boiler Manual', 'Controls Manual'],
  waste: ['Bin Collection Schedule', 'Waste Management Guide'],
  parking: ['Parking Map', 'Parking Rules'],
  warranties: ['Warranty Documentation', 'Builder Warranty Certificate'],
  snagging: ['Snagging Guide', 'Defect Reporting Instructions'],
  utilities: ['Utility Setup Guide', 'Meter Location Map'],
  general: ['Welcome Pack', 'Homeowner Handbook'],
};

export function getSuggestedFix(
  gapReason: GapReason,
  intentType?: string | null,
  attemptedSources?: string[]
): GapSuggestion {
  const intent = intentType || 'general';
  
  switch (gapReason) {
    case 'missing_scheme_data': {
      const fields = SCHEME_FIELD_SUGGESTIONS[intent] || SCHEME_FIELD_SUGGESTIONS.general;
      return {
        action: `Add or update the following scheme profile fields: ${fields}`,
        field: fields,
        priority: 'high',
      };
    }
    
    case 'no_documents_found': {
      const categories = DOC_CATEGORY_SUGGESTIONS[intent] || DOC_CATEGORY_SUGGESTIONS.general;
      return {
        action: `Upload documents in these categories: ${categories.join(', ')}`,
        category: categories[0],
        priority: 'high',
      };
    }
    
    case 'low_doc_confidence': {
      return {
        action: 'Review and re-tag the relevant document to improve classification, or upload a clearer version',
        priority: 'medium',
      };
    }
    
    case 'category_mismatch': {
      const categories = DOC_CATEGORY_SUGGESTIONS[intent] || DOC_CATEGORY_SUGGESTIONS.general;
      return {
        action: `The document retrieved did not match the query category. Consider uploading a document tagged as: ${categories[0]}`,
        category: categories[0],
        priority: 'medium',
      };
    }
    
    case 'scheme_mismatch': {
      return {
        action: 'Ensure documents are correctly tagged to this development. Check document metadata and re-upload if needed.',
        priority: 'high',
      };
    }
    
    case 'validation_failed': {
      return {
        action: 'Document validation failed. Review the document for scheme/unit tagging accuracy and re-upload.',
        priority: 'high',
      };
    }
    
    case 'playbook_fallback': {
      const fields = SCHEME_FIELD_SUGGESTIONS[intent] || SCHEME_FIELD_SUGGESTIONS.general;
      const categories = DOC_CATEGORY_SUGGESTIONS[intent] || DOC_CATEGORY_SUGGESTIONS.general;
      return {
        action: `Add scheme data (${fields}) or upload relevant documents (${categories[0]}) to provide grounded answers`,
        field: fields,
        category: categories[0],
        priority: 'medium',
      };
    }
    
    case 'defer_to_developer': {
      return {
        action: 'This query type requires developer-specific information. Consider adding custom instructions or FAQ content.',
        priority: 'low',
      };
    }
    
    case 'defer_to_omc': {
      return {
        action: 'This query relates to management company responsibilities. No action needed unless you want to add informational content.',
        priority: 'low',
      };
    }
    
    default: {
      return {
        action: 'Review the query type and consider adding relevant scheme data or documents.',
        priority: 'low',
      };
    }
  }
}

export function enrichGapLogWithSuggestion(
  log: {
    gap_reason: string;
    intent_type?: string | null;
    attempted_sources?: string[];
  }
): { suggested_fix: string; fix_priority: string } {
  const suggestion = getSuggestedFix(
    log.gap_reason as GapReason,
    log.intent_type,
    log.attempted_sources
  );
  
  return {
    suggested_fix: suggestion.action,
    fix_priority: suggestion.priority,
  };
}
