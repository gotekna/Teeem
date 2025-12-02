/**
 * Corporate Module - Configuration
 *
 * Centralized configuration for corporate module including table IDs,
 * column width overrides, and other settings.
 */

// =============================================================================
// Foundation Table IDs
// =============================================================================

/**
 * Foundation table IDs for corporate entities.
 * These map to the `foundations` table in the database.
 *
 * NOTE: Assets does not have a Foundation yet - it uses the Asset Rails model directly.
 * TODO: Create Foundation for Assets when needed for schema editor support.
 */
export const CORPORATE_TABLE_IDS = {
  COMPANIES: 353,
  COMPANY_ACTIVITY: 354,
  COMPANY_COMPLIANCE_ITEM: 355,
  COMPANY_DIRECTOR: 356,
  COMPANY_DOCUMENT: 357,
  COMPANY_SETTING: 358,
  COMPANY_XERO_ACCOUNT: 359,
  COMPANY_XERO_CONNECTION: 360,
  // ASSETS: null, // No Foundation yet - uses Asset model directly
} as const;

/**
 * API endpoints for corporate entities.
 */
export const CORPORATE_API_ENDPOINTS = {
  companies: '/api/v1/companies',
  assets: '/api/v1/assets',
  directors: '/api/v1/contacts', // Directors are Contacts with is_director=true
  complianceItems: '/api/v1/company_compliance_items',
  documents: '/api/v1/company_documents',
} as const;

// =============================================================================
// Column Width Overrides
// =============================================================================

/**
 * Custom column width overrides by entity type.
 * These override the default widths from COLUMN_TYPE_DEFAULTS.
 */
export const COLUMN_WIDTH_OVERRIDES = {
  companies: {
    id: 60,
    name: 250,
    code: 80,
    company_group: 120,
    status: 120,
    formatted_acn: 130,
    formatted_abn: 150,
    entity_type: 120,
  },
  assets: {
    id: 60,
    name: 200,
    asset_type: 120,
    status: 100,
    purchase_price: 120,
    current_book_value: 130,
    make: 100,
    model: 100,
  },
  directors: {
    id: 60,
    full_name: 200,
    email: 180,
    mobile_phone: 130,
    director_position: 120,
  },
} as const;

// =============================================================================
// Editable Columns
// =============================================================================

/**
 * Columns that should be editable inline for each entity type.
 */
export const EDITABLE_COLUMNS = {
  companies: ['code', 'entity_type', 'status', 'acn', 'abn', 'name'],
  assets: ['name', 'asset_type', 'status', 'make', 'model', 'description'],
  directors: [], // Directors edited via detail page, not inline
} as const;

// =============================================================================
// Type Exports
// =============================================================================

export type CorporateEntityType = 'companies' | 'assets' | 'directors';
