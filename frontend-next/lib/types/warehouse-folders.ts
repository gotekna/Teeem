// WarehouseFolder types - SSoT for folder/storage configuration
// SSoT Rename (Feb 2026): EntityTab → StorageLocation → WarehouseFolder
// "WarehouseFolder" is THE ONE name - all aliases removed
// API Endpoint: /api/v1/warehouse_folders

// SSoT: 'corporate' is THE ONE scope for corporate entities (Jan 2026 - 'corporate_entity' renamed)
// SSoT: 'contact' is THE ONE scope for all individuals (Jan 2026 - 'people' merged into 'contact')
export type WarehouseFolderScope = 'corporate' | 'job' | 'contact' | 'email' | 'warehouse' | 'task' | 'xero';

// Tab groups - matches backend WarehouseFolder::TAB_GROUPS
// 'system' is for system-managed tabs (email storage, warehousing) - read-only in UI
export type TabGroup = 'overview' | 'documents' | 'reports' | 'data' | 'setup' | 'main' | 'system';

// Display modes for tabs - matches backend WarehouseFolder::DISPLAY_MODES
// - 'both': Show icon + text (default)
// - 'icon_only': Show only icon (root tabs only, tooltip shows name)
// - 'text_only': Show only text (no icon)
export type TabDisplayMode = 'both' | 'icon_only' | 'text_only';

export interface WarehouseFolder {
  id: number;
  scope: WarehouseFolderScope;
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
  is_system?: boolean;  // SSoT: System folder (system-generated content)
  is_mailbox?: boolean;  // SSoT: Mailbox folder (shows synced email mailboxes)
  dynamic_type?: 'mailbox' | null;  // SSoT: Dynamic folder type (computed from is_mailbox or folder_segment tokens)
  // SSoT: Visibility rules - when this tab is shown/hidden
  visibility_rule: string | null;  // Human-readable condition (e.g., "Has Xero links AND is supplier")
  // SSoT: Xero integration fields
  xero_scope: 'primary' | null;  // Which Xero account this tab uses
  xero_account_name: string | null;  // Resolved name (e.g., "Teeem Homes")
  warehouse_enabled: boolean;
  folder_path: string | null;  // SSoT: Path template (e.g., "Cases/{{CaseId}}")
  download_name: string | null;  // SSoT: Document Download Name template (null = use default {{OriginalFileName}})
  ui_name: string | null;  // SSoT: Document UI Name template (null = use default {{OriginalFileName}})
  full_warehouse_path: string | null;
  // SSoT: Template inheritance fields
  uses_custom_path: boolean;
  warehouse_type_override: 'corporate' | 'contacts';
  warehouse_base_path: string | null;
  base_folder_path_template: string | null;  // SSoT: Template from base_folders table
  effective_warehouse_path: string | null;
  upload_path: string | null;  // For uploads (derived from effective_warehouse_path)
  inherited_template: string | null;
  hierarchy_path: string;
  document_count: number;
  can_delete: boolean;
  children: WarehouseFolder[];
  document_types: WarehouseFolderDocumentType[];
  is_photo_category: boolean;
  is_cad_category: boolean;
}

export interface WarehouseFolderDocumentType {
  id: number;
  name: string;
  ui_name: string;
  abbreviation?: string;
  download_name?: string;
  is_primary?: boolean;  // SSoT: true = this tab is the primary home, false = secondary ("also show in")
}

export interface WarehouseFoldersResponse {
  success: boolean;
  data: {
    scope: WarehouseFolderScope;
    tabs: WarehouseFolder[];
    groups: TabGroup[];
    primary_xero_name: string | null;  // SSoT: Name of primary Xero account
  };
}

export interface WarehouseFolderResponse {
  success: boolean;
  data: WarehouseFolder;
}

export interface WarehouseFolderCreateParams {
  scope: WarehouseFolderScope;
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
  warehouse_enabled?: boolean;
  folder_path?: string;
  uses_custom_path?: boolean;  // SSoT: Template inheritance flag
  warehouse_type_override?: 'corporate' | 'contacts';  // SSoT: Path type
  document_type_ids?: number[];  // SSoT: Link document types to this tab
  is_photo_category?: boolean;  // SSoT: Show photo gallery instead of file table
  is_cad_category?: boolean;  // SSoT: Show CAD/Revit file viewer
  display_mode?: TabDisplayMode;  // SSoT: How tab renders
  hidden_by_default?: boolean;  // SSoT: Tab hidden in overflow menu
  is_system_tab?: boolean;  // SSoT: System-locked tabs cannot be deleted
  is_mailbox?: boolean;  // SSoT: Mailbox folder flag
}

export interface WarehouseFolderUpdateParams {
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
  warehouse_enabled?: boolean;
  folder_path?: string;
  uses_custom_path?: boolean;  // SSoT: Template inheritance flag
  warehouse_type_override?: 'corporate' | 'contacts';  // SSoT: Path type
  document_type_ids?: number[];  // SSoT: Link document types to this tab
  is_photo_category?: boolean;  // SSoT: Show photo gallery instead of file table
  is_cad_category?: boolean;  // SSoT: Show CAD/Revit file viewer
  display_mode?: TabDisplayMode;  // SSoT: How tab renders
  hidden_by_default?: boolean;  // SSoT: Tab hidden in overflow menu
  is_system_tab?: boolean;  // SSoT: System-locked tabs cannot be deleted
  is_mailbox?: boolean;  // SSoT: Mailbox folder flag
}

export interface ReorderTabParams {
  id: number;
  parent_id: number | null;
}

// Scope display names for UI
export const SCOPE_LABELS: Record<WarehouseFolderScope, string> = {
  corporate: 'Corporate',
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

// ============================================================================
// DEPRECATED ALIASES - For backwards compatibility during migration
// These will be removed in a future release
// ============================================================================
/** @deprecated Use WarehouseFolderScope instead */
export type EntityTabScope = WarehouseFolderScope;
/** @deprecated Use WarehouseFolder instead */
export type EntityTab = WarehouseFolder;
/** @deprecated Use WarehouseFolderDocumentType instead */
export type EntityTabDocumentType = WarehouseFolderDocumentType;
/** @deprecated Use WarehouseFoldersResponse instead */
export type EntityTabsResponse = WarehouseFoldersResponse;
/** @deprecated Use WarehouseFolderResponse instead */
export type EntityTabResponse = WarehouseFolderResponse;
/** @deprecated Use WarehouseFolderCreateParams instead */
export type EntityTabCreateParams = WarehouseFolderCreateParams;
/** @deprecated Use WarehouseFolderUpdateParams instead */
export type EntityTabUpdateParams = WarehouseFolderUpdateParams;
