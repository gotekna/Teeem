// StorageLocation types - SSoT for folder/storage configuration
// Renamed from EntityTab → StorageLocation (Jan 2026)
// "StorageLocation" is clearer - it's a folder configuration, not a UI tab
// Legacy name "EntityTab" kept as alias for backward compatibility

// SSoT: 'contact' is THE ONE scope for all individuals (Jan 2026 - 'people' merged into 'contact')
export type EntityTabScope = 'corporate_entity' | 'job' | 'contact' | 'email' | 'warehouse' | 'task' | 'xero';

// Tab groups - matches backend EntityTab::TAB_GROUPS
// 'system' is for system-managed tabs (email storage, warehousing) - read-only in UI
export type TabGroup = 'overview' | 'documents' | 'reports' | 'data' | 'setup' | 'main' | 'system';

// Display modes for tabs - matches backend EntityTab::DISPLAY_MODES
// - 'both': Show icon + text (default)
// - 'icon_only': Show only icon (root tabs only, tooltip shows name)
// - 'text_only': Show only text (no icon)
export type TabDisplayMode = 'both' | 'icon_only' | 'text_only';

export interface EntityTab {
  id: number;
  scope: EntityTabScope;
  tab_key: string;
  display_name: string;
  display_code: string | null;
  description: string | null;
  tab_group: TabGroup | null;
  parent_id: number | null;
  job_id: number | null;
  entity_filters: string[];
  order_position: number;
  enabled: boolean;
  icon_name: string | null;
  effective_icon_name: string;  // SSoT: Computed icon (inherits from parent if not set)
  display_mode: TabDisplayMode;  // SSoT: How tab renders (icon_only, text_only, both)
  hidden_by_default: boolean;  // SSoT: Tab hidden in overflow menu by default
  component_name: string | null;
  is_system_tab: boolean;
  // SSoT: Visibility rules - when this tab is shown/hidden
  visibility_rule: string | null;  // Human-readable condition (e.g., "Has Xero links AND is supplier")
  // SSoT: Xero integration fields
  xero_scope: 'primary' | null;  // Which Xero account this tab uses
  xero_account_name: string | null;  // Resolved name (e.g., "Teeem Homes")
  has_sharepoint_folder: boolean;
  sharepoint_folder_path: string | null;
  full_sharepoint_path: string | null;
  // SSoT: Template inheritance fields
  uses_custom_path: boolean;
  sharepoint_path_type: 'corporate' | 'contacts';
  sharepoint_base_path: string | null;
  effective_sharepoint_path: string | null;
  folder_path: string | null;  // Alias for effective_sharepoint_path (frontend compatibility)
  inherited_template: string | null;
  hierarchy_path: string;
  document_count: number;
  can_delete: boolean;
  children: EntityTab[];
  document_types: EntityTabDocumentType[];
  is_photo_category: boolean;
  is_cad_category: boolean;
}

export interface EntityTabDocumentType {
  id: number;
  name: string;
  display_name: string;
  abbreviation?: string;
  file_name?: string;
  is_primary?: boolean;  // SSoT: true = this tab is the primary home, false = secondary ("also show in")
}

export interface EntityTabsResponse {
  success: boolean;
  data: {
    scope: EntityTabScope;
    tabs: EntityTab[];
    groups: TabGroup[];
    primary_xero_name: string | null;  // SSoT: Name of primary Xero account
  };
}

export interface EntityTabResponse {
  success: boolean;
  data: EntityTab;
}

export interface EntityTabCreateParams {
  scope: EntityTabScope;
  tab_key: string;
  display_name: string;
  display_code?: string;
  description?: string;
  tab_group?: TabGroup;
  parent_id?: number | null;
  job_id?: number;
  entity_filters?: string[];
  order_position?: number;
  enabled?: boolean;
  icon_name?: string;
  component_name?: string;
  has_sharepoint_folder?: boolean;
  sharepoint_folder_path?: string;
  uses_custom_path?: boolean;  // SSoT: Template inheritance flag
  sharepoint_path_type?: 'corporate' | 'contacts';  // SSoT: Path type for contacts
  document_type_ids?: number[];  // SSoT: Link document types to this tab
  is_photo_category?: boolean;  // SSoT: Show photo gallery instead of file table
  is_cad_category?: boolean;  // SSoT: Show CAD/Revit file viewer
  display_mode?: TabDisplayMode;  // SSoT: How tab renders
  hidden_by_default?: boolean;  // SSoT: Tab hidden in overflow menu
}

export interface EntityTabUpdateParams {
  display_name?: string;
  display_code?: string;
  description?: string;
  tab_group?: TabGroup;
  parent_id?: number | null;  // null to remove parent (make root-level)
  entity_filters?: string[];
  order_position?: number;
  enabled?: boolean;
  icon_name?: string;
  component_name?: string;
  has_sharepoint_folder?: boolean;
  sharepoint_folder_path?: string;
  uses_custom_path?: boolean;  // SSoT: Template inheritance flag
  sharepoint_path_type?: 'corporate' | 'contacts';  // SSoT: Path type for contacts
  document_type_ids?: number[];  // SSoT: Link document types to this tab
  is_photo_category?: boolean;  // SSoT: Show photo gallery instead of file table
  is_cad_category?: boolean;  // SSoT: Show CAD/Revit file viewer
  display_mode?: TabDisplayMode;  // SSoT: How tab renders
  hidden_by_default?: boolean;  // SSoT: Tab hidden in overflow menu
}

export interface ReorderTabParams {
  id: number;
  parent_id: number | null;
}

// Scope display names for UI
// SSoT: 'contact' is THE ONE scope for all individuals (Jan 2026 - 'people' merged into 'contact')
export const SCOPE_LABELS: Record<EntityTabScope, string> = {
  corporate_entity: 'Corporate Entity',
  job: 'Job',
  contact: 'Contact',
  email: 'Email',
  warehouse: 'Warehouse',
  task: 'Task',
  xero: 'Xero',
};

// Tab group display names for UI
export const GROUP_LABELS: Record<TabGroup, string> = {
  overview: 'Overview',
  documents: 'Documents',
  reports: 'Reports',
  data: 'Data',
  setup: 'Setup',
  main: 'Main',
  system: 'System',
};

// Entity type options are now fetched from API (SSoT: CorporateCompanySetting)
// See: GET /api/v1/entity_tabs/entity_types

// ============================================================================
// SSoT Rename (Jan 2026): EntityTab → StorageLocation
// "StorageLocation" is clearer - it's a folder configuration, not a UI tab
// These aliases allow gradual migration to new naming while maintaining compatibility
// ============================================================================
export type StorageLocationScope = EntityTabScope;
export type StorageLocation = EntityTab;
export type StorageLocationDocumentType = EntityTabDocumentType;
export type StorageLocationsResponse = EntityTabsResponse;
export type StorageLocationResponse = EntityTabResponse;
export type StorageLocationCreateParams = EntityTabCreateParams;
export type StorageLocationUpdateParams = EntityTabUpdateParams;
