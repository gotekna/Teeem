// SSoT: Foundation and Column type definitions
// Import from @/lib/types - NEVER define locally

/**
 * API column format (what the backend returns)
 */
export interface ApiColumn {
  id: number;
  foundation_id?: number;
  column_name: string;
  name: string;
  column_type: string;
  description?: string;
  available_choices?: string[] | { id: number; value: string }[];
  lookup_foundation_id?: number;
  lookup_foundation_slug?: string;
  lookup_display_column?: string;
  required?: boolean;
  is_unique?: boolean;
  searchable?: boolean;
  settings?: Record<string, unknown>;
  header_align?: string;
  data_align?: string;
}

/**
 * Foundation metadata
 * Represents a table/entity in the system
 */
export interface Foundation {
  id: number;
  name: string;
  slug?: string;
  table_type?: 'system' | 'user';
  model_class?: string;
  database_table_name?: string;
  api_endpoint?: string;
  columns: ApiColumn[];
}
