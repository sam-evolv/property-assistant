/**
 * Smart Column Mapping Engine
 *
 * Maps spreadsheet column headers to OpenHouse fields using
 * fuzzy matching against known Irish development spreadsheet patterns.
 */

export interface MappingSuggestion {
  index: number;
  header: string;
  sample_values: string[];
  suggested_mapping: {
    oh_table: string;
    oh_field: string;
    confidence: number;
  } | null;
}

const KNOWN_MAPPINGS: Record<string, { table: string; field: string }> = {
  // Unit identification
  'unit no': { table: 'units', field: 'address' },
  'unit no.': { table: 'units', field: 'address' },
  'unit number': { table: 'units', field: 'address' },
  'house no': { table: 'units', field: 'address' },
  'house number': { table: 'units', field: 'address' },
  'plot': { table: 'units', field: 'address' },
  'plot no': { table: 'units', field: 'address' },
  'lot': { table: 'units', field: 'address' },

  // House type
  'house type': { table: 'units', field: 'unit_type_id' },
  'type': { table: 'units', field: 'unit_type_id' },
  'property type': { table: 'units', field: 'unit_type_id' },
  'bed': { table: 'units', field: 'unit_type_id' },
  'beds': { table: 'units', field: 'unit_type_id' },

  // Purchaser details
  'purchaser': { table: 'unit_sales_pipeline', field: 'purchaser_name' },
  'purchaser name': { table: 'unit_sales_pipeline', field: 'purchaser_name' },
  'buyer': { table: 'unit_sales_pipeline', field: 'purchaser_name' },
  'buyer name': { table: 'unit_sales_pipeline', field: 'purchaser_name' },
  'customer': { table: 'unit_sales_pipeline', field: 'purchaser_name' },
  'purchaser email': { table: 'unit_sales_pipeline', field: 'purchaser_email' },
  'email': { table: 'unit_sales_pipeline', field: 'purchaser_email' },
  'purchaser phone': { table: 'unit_sales_pipeline', field: 'purchaser_phone' },
  'phone': { table: 'unit_sales_pipeline', field: 'purchaser_phone' },
  'mobile': { table: 'unit_sales_pipeline', field: 'purchaser_phone' },

  // Solicitor
  'solicitor': { table: 'unit_sales_pipeline', field: 'purchaser_solicitor' },
  'purchaser solicitor': { table: 'unit_sales_pipeline', field: 'purchaser_solicitor' },
  'buyer solicitor': { table: 'unit_sales_pipeline', field: 'purchaser_solicitor' },
  'vendor solicitor': { table: 'unit_sales_pipeline', field: 'vendor_solicitor' },

  // Sales pipeline stages
  'status': { table: 'unit_sales_pipeline', field: 'status' },
  'sale status': { table: 'unit_sales_pipeline', field: 'status' },
  'booking deposit': { table: 'unit_sales_pipeline', field: 'booking_deposit_date' },
  'deposit': { table: 'unit_sales_pipeline', field: 'booking_deposit_date' },
  'deposit paid': { table: 'unit_sales_pipeline', field: 'booking_deposit_date' },
  'contract signed': { table: 'unit_sales_pipeline', field: 'contracts_signed_date' },
  'contracts signed': { table: 'unit_sales_pipeline', field: 'contracts_signed_date' },
  'contract date': { table: 'unit_sales_pipeline', field: 'contracts_signed_date' },
  'loan approved': { table: 'unit_sales_pipeline', field: 'loan_approval_date' },
  'loan approval': { table: 'unit_sales_pipeline', field: 'loan_approval_date' },
  'mortgage approved': { table: 'unit_sales_pipeline', field: 'loan_approval_date' },
  'snag': { table: 'unit_sales_pipeline', field: 'snag_date' },
  'snag date': { table: 'unit_sales_pipeline', field: 'snag_date' },
  'snagging': { table: 'unit_sales_pipeline', field: 'snag_date' },
  'de-snag': { table: 'unit_sales_pipeline', field: 'desnag_date' },
  'desnag': { table: 'unit_sales_pipeline', field: 'desnag_date' },
  'closing': { table: 'unit_sales_pipeline', field: 'closing_date' },
  'closing date': { table: 'unit_sales_pipeline', field: 'closing_date' },
  'completion': { table: 'unit_sales_pipeline', field: 'closing_date' },
  'handover': { table: 'unit_sales_pipeline', field: 'handover_date' },
  'handover date': { table: 'unit_sales_pipeline', field: 'handover_date' },

  // Financial
  'price': { table: 'unit_sales_pipeline', field: 'sale_price' },
  'sale price': { table: 'unit_sales_pipeline', field: 'sale_price' },
  'asking price': { table: 'unit_sales_pipeline', field: 'sale_price' },

  // Kitchen
  'kitchen': { table: 'kitchen_selections', field: 'selection' },
  'kitchen selection': { table: 'kitchen_selections', field: 'selection' },
  'kitchen choice': { table: 'kitchen_selections', field: 'selection' },

  // Notes
  'notes': { table: 'unit_pipeline_notes', field: 'content' },
  'comments': { table: 'unit_pipeline_notes', field: 'content' },
};

/**
 * Calculate Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score between two strings (0-1).
 */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

/**
 * Suggest field mappings for spreadsheet column headers.
 */
export function suggestMappings(
  headers: string[],
  sampleData?: string[][]
): MappingSuggestion[] {
  return headers.map((header, index) => {
    const normalized = header.toLowerCase().trim();
    const samples = sampleData?.[index] || [];

    // Helper to convert KNOWN_MAPPINGS entry to suggestion format
    const toSuggestion = (m: { table: string; field: string }, conf: number) => ({
      oh_table: m.table,
      oh_field: m.field,
      confidence: conf,
    });

    // Exact match
    if (KNOWN_MAPPINGS[normalized]) {
      return {
        index,
        header,
        sample_values: samples,
        suggested_mapping: toSuggestion(KNOWN_MAPPINGS[normalized], 1.0),
      };
    }

    // Fuzzy match — find best match using Levenshtein distance
    let bestMatch: { oh_table: string; oh_field: string; confidence: number } | null = null;
    let bestScore = 0;

    for (const [knownHeader, mapping] of Object.entries(KNOWN_MAPPINGS)) {
      const score = similarity(normalized, knownHeader);
      if (score > bestScore && score > 0.6) {
        bestScore = score;
        bestMatch = toSuggestion(mapping, score);
      }
    }

    // Also check if the header contains a known keyword
    if (!bestMatch || bestMatch.confidence < 0.8) {
      for (const [knownHeader, mapping] of Object.entries(KNOWN_MAPPINGS)) {
        if (normalized.includes(knownHeader) || knownHeader.includes(normalized)) {
          const containScore = Math.max(
            knownHeader.length / normalized.length,
            normalized.length / knownHeader.length
          ) * 0.85;

          if (containScore > (bestMatch?.confidence || 0)) {
            bestMatch = toSuggestion(mapping, Math.min(containScore, 0.95));
          }
        }
      }
    }

    return {
      index,
      header,
      sample_values: samples,
      suggested_mapping: bestMatch,
    };
  });
}

/**
 * Get all available OpenHouse target fields for manual mapping.
 */
export function getAvailableTargetFields(): Array<{
  table: string;
  field: string;
  label: string;
  type: string;
}> {
  return [
    { table: 'units', field: 'address', label: 'Unit Number / Address', type: 'text' },
    { table: 'units', field: 'unit_type_id', label: 'House Type', type: 'reference' },
    { table: 'unit_sales_pipeline', field: 'purchaser_name', label: 'Purchaser Name', type: 'text' },
    { table: 'unit_sales_pipeline', field: 'purchaser_email', label: 'Purchaser Email', type: 'email' },
    { table: 'unit_sales_pipeline', field: 'purchaser_phone', label: 'Purchaser Phone', type: 'phone' },
    { table: 'unit_sales_pipeline', field: 'purchaser_solicitor', label: 'Purchaser Solicitor', type: 'text' },
    { table: 'unit_sales_pipeline', field: 'vendor_solicitor', label: 'Vendor Solicitor', type: 'text' },
    { table: 'unit_sales_pipeline', field: 'status', label: 'Sale Status', type: 'enum' },
    { table: 'unit_sales_pipeline', field: 'sale_price', label: 'Sale Price', type: 'currency' },
    { table: 'unit_sales_pipeline', field: 'booking_deposit_date', label: 'Booking Deposit Date', type: 'date' },
    { table: 'unit_sales_pipeline', field: 'contracts_signed_date', label: 'Contracts Signed Date', type: 'date' },
    { table: 'unit_sales_pipeline', field: 'loan_approval_date', label: 'Loan Approval Date', type: 'date' },
    { table: 'unit_sales_pipeline', field: 'snag_date', label: 'Snag Date', type: 'date' },
    { table: 'unit_sales_pipeline', field: 'desnag_date', label: 'De-Snag Date', type: 'date' },
    { table: 'unit_sales_pipeline', field: 'closing_date', label: 'Closing Date', type: 'date' },
    { table: 'unit_sales_pipeline', field: 'handover_date', label: 'Handover Date', type: 'date' },
    { table: 'kitchen_selections', field: 'selection', label: 'Kitchen Selection', type: 'text' },
    { table: 'unit_pipeline_notes', field: 'content', label: 'Notes / Comments', type: 'text' },
  ];
}
