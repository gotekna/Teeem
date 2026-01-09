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
 * Foundation IDs for corporate entities.
 *
 * SSoT for columns is the Foundation API (Gold Standard Tables).
 * Data comes from Rails models (CorporateCompany, Asset, Contact).
 */
export const CORPORATE_TABLE_IDS = {
  // Active Foundation IDs
  ASSETS: 526,              // Assets Foundation - Gold Standard Table
  COMPANY_DOCUMENT: 357,    // Company Documents Foundation

  // Legacy IDs (do not use - these Foundations were never created)
  COMPANIES: 353,           // Use CorporateCompany Rails model, no Foundation
  COMPANY_ACTIVITY: 354,
  COMPANY_COMPLIANCE_ITEM: 355,
  COMPANY_DIRECTOR: 356,
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
    asset_number: 120,
    display_name: 250,
    asset_type: 100,
    status: 100,
    company_name: 180,
    purchase_price: 130,
    purchase_date: 110,
    current_book_value: 130,
    location: 150,
    assigned_to_name: 150,
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
