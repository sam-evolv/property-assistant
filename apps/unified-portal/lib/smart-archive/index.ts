/**
 * Smart Archive Module
 * 
 * Provides document validation, category detection, and reliable retrieval
 * for the Smart Archive feature.
 */

export {
  type DocCategory,
  type DocumentMetadata,
  type ValidationResult,
  type ValidationContext,
  type ValidatedDocument,
  type FilterableDocument,
  type GuidedFallback,
  type AnswerGapLog,
  validateDocMatch,
  filterByValidation,
  inferCategoryFromText,
  inferCategoryFromDiscipline,
  generateGuidedFallback,
  logAnswerGap,
} from './validate';

export {
  type DocumentChunk,
  type ValidatedSearchResult,
  type SearchOptions,
  searchWithValidation,
  detectIntentCategory,
  formatValidationFallbackResponse,
} from './validated-search';
