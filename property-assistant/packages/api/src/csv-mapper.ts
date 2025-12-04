/**
 * Universal CSV/XLSX Column Mapping System
 * 
 * Handles case-insensitive column matching to support various CSV formats
 * from different developers and sources.
 */

export interface ColumnMapping {
  [standardKey: string]: string[];
}

/**
 * Universal column mappings for house/unit data
 * Maps standard field names to various possible column names in CSVs
 */
export const HOUSE_COLUMN_MAPPINGS: ColumnMapping = {
  // House/Unit Number
  unit_number: [
    'house_number',
    'house number',
    'house_no',
    'house no',
    'unit_number',
    'unit number',
    'unit_no',
    'unit no',
    'no',
    'number',
    '#',
  ],
  
  // Unique Identifier
  unique_id: [
    'unique_id',
    'unique id',
    'uid',
    'id',
    'unit_uid',
    'house_uid',
    'house_id',
    'unit_id',
  ],
  
  // Address
  address: [
    'address',
    'address_line_1',
    'address line 1',
    'street_address',
    'street address',
    'full_address',
    'full address',
  ],
  
  address_line_2: [
    'address_line_2',
    'address line 2',
    'address2',
    'street2',
  ],
  
  city: [
    'city',
    'town',
  ],
  
  state_province: [
    'state_province',
    'state/province',
    'state',
    'province',
    'county',
  ],
  
  postal_code: [
    'postal_code',
    'postal code',
    'postcode',
    'post code',
    'zip',
    'zipcode',
    'zip code',
  ],
  
  country: [
    'country',
    'nation',
  ],
  
  // Eircode (Irish postal code)
  eircode: [
    'eircode',
  ],
  
  // House Type Code
  house_type_code: [
    'house_type_code',
    'house type code',
    'house_type',
    'house type',
    'type_code',
    'type code',
    'type',
    'house_model',
    'model',
    'plan',
  ],
  
  // Property Details
  bedrooms: [
    'bedrooms',
    'bedrooms_raw',
    'beds',
    'bed',
    'bedroom',
    'no_of_bedrooms',
    'number_of_bedrooms',
  ],
  
  bathrooms: [
    'bathrooms',
    'baths',
    'bath',
    'bathroom',
    'no_of_bathrooms',
  ],
  
  square_footage: [
    'square_footage',
    'square footage',
    'sq_ft',
    'sqft',
    'sq ft',
    'sq_feet',
    'square_feet',
    'square feet',
  ],
  
  floor_area_m2: [
    'floor_area_m2',
    'floor area m2',
    'floor_area',
    'floor area',
    'sq_meters',
    'sq meters',
    'sqm',
    'area',
    'size',
  ],
  
  property_type: [
    'property_type',
    'property type',
    'dwelling_type',
    'dwelling type',
  ],
  
  property_designation: [
    'property_designation',
    'property designation',
    'designation',
  ],
  
  // Purchaser Information
  purchaser_name: [
    'purchaser_name',
    'purchaser name',
    'owner_name',
    'owner name',
    'buyer_name',
    'buyer name',
    'resident_name',
    'resident name',
  ],
  
  purchaser_email: [
    'purchaser_email',
    'purchaser email',
    'owner_email',
    'owner email',
    'buyer_email',
    'email',
    'resident_email',
  ],
  
  purchaser_phone: [
    'purchaser_phone',
    'purchaser phone',
    'owner_phone',
    'owner phone',
    'phone',
    'mobile',
    'contact',
    'resident_phone',
  ],
  
  // Utility Connections
  mrpn: [
    'mrpn',
    'mprn',
    'meter_point_reference',
    'gas_meter',
  ],
  
  electricity_account: [
    'electricity_account',
    'electricity account',
    'electric_account',
    'power_account',
  ],
  
  esb_eirgrid_number: [
    'esb_eirgrid_number',
    'esb number',
    'eirgrid_number',
    'eirgrid',
  ],
  
  // Unit Code (marketing code)
  unit_code: [
    'unit_code',
    'unit code',
    'marketing_code',
    'marketing code',
    'code',
  ],
  
  // Notes/Comments
  notes: [
    'notes',
    'note',
    'comments',
    'comment',
    'remarks',
  ],
};

/**
 * Normalize a column name for matching (lowercase, trim, remove special chars)
 */
function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[_\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Find the standard field name for a given CSV column header
 */
export function mapColumnName(csvColumnName: string): string | null {
  // Skip empty column headers (caused by trailing commas in CSV)
  if (!csvColumnName || csvColumnName.trim() === '') {
    return null;
  }
  
  const normalized = normalizeColumnName(csvColumnName);
  
  // Skip if normalization results in empty string
  if (!normalized) {
    return null;
  }
  
  // Try exact match first
  for (const [standardKey, variants] of Object.entries(HOUSE_COLUMN_MAPPINGS)) {
    for (const variant of variants) {
      if (normalizeColumnName(variant) === normalized) {
        return standardKey;
      }
    }
  }
  
  // If no match found, return null
  return null;
}

/**
 * Map all CSV headers to standard field names
 * Returns a map of: CSV column name → standard field name
 */
export function mapAllColumns(csvHeaders: string[]): Map<string, string> {
  const mappings = new Map<string, string>();
  
  for (const header of csvHeaders) {
    const standardName = mapColumnName(header);
    if (standardName) {
      mappings.set(header, standardName);
    }
  }
  
  return mappings;
}

/**
 * Extract and map a single row from CSV to standard field names
 */
export function mapRow(
  row: Record<string, any>,
  columnMappings: Map<string, string>
): Record<string, any> {
  const mapped: Record<string, any> = {};
  
  for (const [csvColumn, value] of Object.entries(row)) {
    const standardField = columnMappings.get(csvColumn);
    if (standardField) {
      // Trim strings
      mapped[standardField] = typeof value === 'string' ? value.trim() : value;
    }
  }
  
  return mapped;
}

/**
 * Validate required fields are present
 */
export function validateRequiredFields(
  row: Record<string, any>,
  rowIndex: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Required fields for house import
  const requiredFields = ['unit_number', 'address', 'house_type_code'];
  
  for (const field of requiredFields) {
    if (!row[field] || (typeof row[field] === 'string' && row[field].trim() === '')) {
      errors.push(`Row ${rowIndex}: Missing required field '${field}'`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
