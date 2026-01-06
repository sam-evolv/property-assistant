/**
 * Smart Archive Document Validation
 * 
 * Validates that retrieved documents match the user's intent and scope.
 * Prevents returning incorrect documents by applying confidence scoring.
 */

export type DocCategory = 
  | 'heating'
  | 'electrical'
  | 'plumbing'
  | 'warranties'
  | 'house_rules'
  | 'snagging'
  | 'welcome_pack'
  | 'waste_parking'
  | 'other';

export interface DocumentMetadata {
  scheme_id: string | null;
  category: DocCategory | null;
  unit_code: string | null;
  house_type: string | null;
  discipline: string | null;
  uploaded_at: string | null;
  version_label: string | null;
  file_name: string;
  title: string;
}

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  matchDetails: {
    schemeMatch: boolean;
    categoryMatch: boolean;
    unitMatch: 'exact' | 'compatible' | 'none';
    scoreBreakdown: {
      schemeScore: number;
      categoryScore: number;
      unitScore: number;
    };
  };
  reason?: string;
}

export interface ValidationContext {
  targetSchemeId: string;
  intentCategory: DocCategory | null;
  unitCode?: string | null;
  houseType?: string | null;
}

const CATEGORY_MAPPINGS: Record<string, DocCategory> = {
  heating: 'heating',
  boiler: 'heating',
  thermostat: 'heating',
  radiator: 'heating',
  hvac: 'heating',
  mechanical: 'heating',
  
  electrical: 'electrical',
  wiring: 'electrical',
  fuse: 'electrical',
  circuit: 'electrical',
  lighting: 'electrical',
  socket: 'electrical',
  
  plumbing: 'plumbing',
  water: 'plumbing',
  drainage: 'plumbing',
  pipes: 'plumbing',
  tap: 'plumbing',
  shower: 'plumbing',
  toilet: 'plumbing',
  
  warranty: 'warranties',
  warranties: 'warranties',
  guarantee: 'warranties',
  certificate: 'warranties',
  
  rules: 'house_rules',
  house_rules: 'house_rules',
  regulations: 'house_rules',
  management: 'house_rules',
  
  snag: 'snagging',
  snagging: 'snagging',
  defect: 'snagging',
  punch: 'snagging',
  
  welcome: 'welcome_pack',
  welcome_pack: 'welcome_pack',
  handover: 'welcome_pack',
  move_in: 'welcome_pack',
  
  waste: 'waste_parking',
  parking: 'waste_parking',
  bin: 'waste_parking',
  recycling: 'waste_parking',
};

const DISCIPLINE_TO_CATEGORY: Record<string, DocCategory> = {
  mechanical: 'heating',
  electrical: 'electrical',
  plumbing: 'plumbing',
  handover: 'welcome_pack',
  architectural: 'other',
  structural: 'other',
  civil: 'other',
  landscape: 'other',
  other: 'other',
};

export function inferCategoryFromText(text: string): DocCategory | null {
  const lower = text.toLowerCase();
  
  for (const [keyword, category] of Object.entries(CATEGORY_MAPPINGS)) {
    if (lower.includes(keyword)) {
      return category;
    }
  }
  
  return null;
}

export function inferCategoryFromDiscipline(discipline: string | null): DocCategory {
  if (!discipline) return 'other';
  const lower = discipline.toLowerCase();
  return DISCIPLINE_TO_CATEGORY[lower] || 'other';
}

export function validateDocMatch(
  context: ValidationContext,
  docMetadata: DocumentMetadata
): ValidationResult {
  const scoreBreakdown = {
    schemeScore: 0,
    categoryScore: 0,
    unitScore: 0,
  };
  
  const schemeMatch = 
    docMetadata.scheme_id === context.targetSchemeId ||
    docMetadata.scheme_id === null;
  
  if (schemeMatch) {
    scoreBreakdown.schemeScore = docMetadata.scheme_id ? 40 : 20;
  }
  
  let categoryMatch = false;
  if (context.intentCategory) {
    const docCategory = docMetadata.category || 
      inferCategoryFromText(docMetadata.file_name) ||
      inferCategoryFromText(docMetadata.title) ||
      inferCategoryFromDiscipline(docMetadata.discipline);
    
    categoryMatch = docCategory === context.intentCategory;
    
    if (categoryMatch) {
      scoreBreakdown.categoryScore = 40;
    } else if (docCategory === 'other' || context.intentCategory === 'other') {
      scoreBreakdown.categoryScore = 10;
    }
  } else {
    scoreBreakdown.categoryScore = 20;
    categoryMatch = true;
  }
  
  let unitMatch: 'exact' | 'compatible' | 'none' = 'compatible';
  
  if (docMetadata.unit_code && context.unitCode) {
    if (docMetadata.unit_code === context.unitCode) {
      unitMatch = 'exact';
      scoreBreakdown.unitScore = 20;
    } else {
      unitMatch = 'none';
      scoreBreakdown.unitScore = 0;
    }
  } else if (docMetadata.house_type && context.houseType) {
    if (docMetadata.house_type === context.houseType) {
      unitMatch = 'exact';
      scoreBreakdown.unitScore = 15;
    } else {
      unitMatch = 'none';
      scoreBreakdown.unitScore = 0;
    }
  } else if (!docMetadata.unit_code && !docMetadata.house_type) {
    unitMatch = 'compatible';
    scoreBreakdown.unitScore = 10;
  } else {
    unitMatch = 'compatible';
    scoreBreakdown.unitScore = 5;
  }
  
  const confidence = 
    scoreBreakdown.schemeScore + 
    scoreBreakdown.categoryScore + 
    scoreBreakdown.unitScore;
  
  const isValid = confidence >= 50 && schemeMatch;
  
  let reason: string | undefined;
  if (!isValid) {
    if (!schemeMatch) {
      reason = 'Document belongs to a different scheme';
    } else if (!categoryMatch) {
      reason = 'Document category does not match the query intent';
    } else {
      reason = 'Low overall confidence score';
    }
  }
  
  return {
    isValid,
    confidence,
    matchDetails: {
      schemeMatch,
      categoryMatch,
      unitMatch,
      scoreBreakdown,
    },
    reason,
  };
}

export interface ValidatedDocument<T> {
  document: T;
  validation: ValidationResult;
}

export interface FilterableDocument {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  similarity?: number;
  project_id?: string;
  scheme_id?: string;
  discipline?: string | null;
  house_type_code?: string | null;
  unit_code?: string | null;
  category?: DocCategory | null;
  file_name?: string;
  title?: string;
}

export function filterByValidation<T extends FilterableDocument>(
  documents: T[],
  context: ValidationContext,
  threshold: number = 50
): ValidatedDocument<T>[] {
  const results: ValidatedDocument<T>[] = [];
  
  for (const doc of documents) {
    const metadata: DocumentMetadata = {
      scheme_id: doc.project_id || doc.scheme_id || null,
      category: doc.category || null,
      unit_code: doc.unit_code || doc.metadata?.unit_code || null,
      house_type: doc.house_type_code || doc.metadata?.house_type_code || null,
      discipline: doc.discipline || doc.metadata?.discipline || null,
      uploaded_at: doc.metadata?.created_at || doc.metadata?.uploaded_at || null,
      version_label: doc.metadata?.version_label || null,
      file_name: doc.file_name || doc.metadata?.file_name || 'Unknown',
      title: doc.title || doc.metadata?.source || 'Unknown',
    };
    
    const validation = validateDocMatch(context, metadata);
    
    if (validation.isValid && validation.confidence >= threshold) {
      results.push({ document: doc, validation });
    }
  }
  
  results.sort((a, b) => b.validation.confidence - a.validation.confidence);
  
  return results;
}

export interface GuidedFallback {
  message: string;
  suggestedCategory: DocCategory | null;
  suggestedSearch: string | null;
  askFollowUp: string | null;
}

export function generateGuidedFallback(
  context: ValidationContext,
  attemptedCategory: DocCategory | null
): GuidedFallback {
  const categoryLabels: Record<DocCategory, string> = {
    heating: 'Heating & HVAC',
    electrical: 'Electrical',
    plumbing: 'Plumbing',
    warranties: 'Warranties & Certificates',
    house_rules: 'House Rules',
    snagging: 'Snagging & Defects',
    welcome_pack: 'Welcome Pack & Handover',
    waste_parking: 'Waste & Parking',
    other: 'Other Documents',
  };
  
  if (attemptedCategory) {
    const label = categoryLabels[attemptedCategory];
    return {
      message: `I couldn't find a reliable document matching your query in the ${label} category. This information may not be uploaded to your property's document archive yet.`,
      suggestedCategory: attemptedCategory,
      suggestedSearch: `Try searching for "${attemptedCategory}" in the Smart Archive`,
      askFollowUp: `Would you like me to check a different category, or can you provide more details about what you're looking for?`,
    };
  }
  
  return {
    message: `I couldn't find a document that confidently matches your question. The information may not be in your property's document archive.`,
    suggestedCategory: null,
    suggestedSearch: 'Try browsing the Smart Archive by category',
    askFollowUp: `Can you tell me more specifically what type of document you're looking for? For example: heating manuals, warranty information, or house rules?`,
  };
}

export interface AnswerGapLog {
  timestamp: string;
  scheme_id: string;
  query_text: string;
  intent_category: DocCategory | null;
  gap_reason: 'low_doc_confidence' | 'no_documents' | 'category_mismatch' | 'scheme_mismatch';
  candidates_count: number;
  best_confidence: number | null;
  unit_code: string | null;
  house_type: string | null;
}

export function logAnswerGap(
  db: any,
  log: Omit<AnswerGapLog, 'timestamp'>
): void {
  const entry: AnswerGapLog = {
    ...log,
    timestamp: new Date().toISOString(),
  };
  
  console.log('[SmartArchive] Answer gap logged:', JSON.stringify(entry));
}
