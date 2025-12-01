/**
 * Table UI Configuration Registry
 *
 * Defines UI customizations per table (tabs, features, behaviors).
 * This is separate from the Foundation data which comes from the API.
 */

import { TABLE_IDS } from './url-utils';

/**
 * Tab configuration for tables with multiple views
 */
export interface TableTab {
  id: string;
  label: string;
}

/**
 * UI configuration for a specific table
 */
export interface TableUIConfig {
  // Tabs configuration
  tabs?: TableTab[];
  defaultTab?: string;

  // Feature flags
  enableImport?: boolean;
  enableExport?: boolean;
  enableSchemaEditor?: boolean;

  // Row behavior
  rowClickBehavior?: 'view' | 'edit' | 'none';

  // View options
  viewOnly?: boolean;
  hideUpdateViewButton?: boolean;
  initialGroupByColumn?: string | null;
}

/**
 * Default configuration for tables without specific customizations
 */
export const DEFAULT_TABLE_UI_CONFIG: TableUIConfig = {
  enableExport: true,
  enableImport: false,
  enableSchemaEditor: false,
  rowClickBehavior: 'none',
  viewOnly: false,
};

/**
 * Table-specific UI configurations
 * Key = foundation/table ID
 */
export const TABLE_UI_CONFIG: Record<number, TableUIConfig> = {
  // Gold Standard (Admin System)
  [TABLE_IDS.GOLD_STANDARD]: {
    tabs: [
      { id: 'data', label: 'Data' },
      { id: 'schema', label: 'Schema' },
      { id: 'connections', label: 'Connections' },
    ],
    defaultTab: 'data',
    enableSchemaEditor: true,
    enableImport: true,
    enableExport: true,
  },

  // Jobs
  [TABLE_IDS.JOBS]: {
    enableExport: true,
    rowClickBehavior: 'view',
  },

  // Contacts
  [TABLE_IDS.CONTACTS]: {
    enableExport: true,
    rowClickBehavior: 'view',
  },

  // Price Book
  [TABLE_IDS.PRICEBOOK]: {
    enableExport: true,
    enableImport: true,
    enableSchemaEditor: true,
  },

  // Companies
  [TABLE_IDS.COMPANIES]: {
    enableExport: true,
    rowClickBehavior: 'view',
  },

  // Features Tracking
  [TABLE_IDS.FEATURES_TRACKING]: {
    enableExport: true,
    initialGroupByColumn: 'feature_chapter',
  },
};

/**
 * Get UI configuration for a table, falling back to defaults
 */
export function getTableUIConfig(tableId: number): TableUIConfig {
  return {
    ...DEFAULT_TABLE_UI_CONFIG,
    ...TABLE_UI_CONFIG[tableId],
  };
}

export default TABLE_UI_CONFIG;
