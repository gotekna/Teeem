// EntityTab types - SSoT for unified tab configuration
// Matches backend EntityTab model exactly

export type EntityTabScope = 'corporate_entity' | 'people' | 'job' | 'contact';

// Tab groups - matches backend EntityTab::TAB_GROUPS
export type TabGroup = 'overview' | 'documents' | 'reports' | 'data' | 'setup' | 'main';

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
  component_name: string | null;
  is_system_tab: boolean;
  has_sharepoint_folder: boolean;
  sharepoint_folder_path: string | null;
  full_sharepoint_path: string | null;
  // SSoT: Template inheritance fields
  uses_custom_path: boolean;
  sharepoint_path_type: 'corporate' | 'contacts';
  sharepoint_base_path: string | null;
  effective_sharepoint_path: string | null;
  inherited_template: string | null;
  hierarchy_path: string;
  document_count: number;
  can_delete: boolean;
  children: EntityTab[];
  document_types: EntityTabDocumentType[];
  is_photo_category: boolean;
}

export interface EntityTabDocumentType {
  id: number;
  name: string;
  display_name: string;
  abbreviation?: string;
  file_name?: string;
}

export interface EntityTabsResponse {
  success: boolean;
  data: {
    scope: EntityTabScope;
    tabs: EntityTab[];
    groups: TabGroup[];
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
}

export interface ReorderTabParams {
  id: number;
  parent_id: number | null;
}

// Scope display names for UI
export const SCOPE_LABELS: Record<EntityTabScope, string> = {
  corporate_entity: 'Corporate Entity',
  people: 'People',
  job: 'Job',
  contact: 'Contact',
};

// Tab group display names for UI
export const GROUP_LABELS: Record<TabGroup, string> = {
  overview: 'Overview',
  documents: 'Documents',
  reports: 'Reports',
  data: 'Data',
  setup: 'Setup',
  main: 'Main',
};

// Entity type options are now fetched from API (SSoT: CorporateCompanySetting)
// See: GET /api/v1/entity_tabs/entity_types
