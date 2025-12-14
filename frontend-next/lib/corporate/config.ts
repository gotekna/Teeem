/**
 * Corporate Module - Configuration
 *
 * Centralized configuration for corporate module including table IDs,
 * column width overrides, and other settings.
 */

// =============================================================================
// Foundation Table IDs (DEPRECATED - Corporate uses Rails models, not Foundations)
// =============================================================================

/**
 * @deprecated Corporate entities use Rails models directly (CorporateCompany, Asset, etc.)
 * NOT the Foundation system. These IDs are kept for reference only.
 *
 * SSoT: Corporate module uses hardcoded columns in use-corporate-table.ts
 * The CorporateCompany, Asset, and Contact Rails models are the source of truth.
 *
 * Foundation IDs 353-360 were never created in the database.
 * Only COMPANY_DOCUMENT (357) exists as a Foundation.
 */
export const CORPORATE_TABLE_IDS = {
  // These Foundation IDs DO NOT EXIST in database - do not use for API calls
  COMPANIES: 353,           // Use CorporateCompany Rails model instead
  COMPANY_ACTIVITY: 354,    // Use CorporateCompanyActivity Rails model instead
  COMPANY_COMPLIANCE_ITEM: 355,
  COMPANY_DIRECTOR: 356,    // Use CorporateCompanyDirector Rails model instead
  COMPANY_DOCUMENT: 357,    // This one DOES exist as a Foundation
  COMPANY_SETTING: 358,
  COMPANY_XERO_ACCOUNT: 359,
  COMPANY_XERO_CONNECTION: 360,
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
    display_name: 200,
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
