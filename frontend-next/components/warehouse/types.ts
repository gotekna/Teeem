/**
 * Shared types for the Warehouse tree system.
 *
 * SSoT: These types are used by both the main /warehouse page and
 * entity-scoped warehouse tabs (Job, Contact, Corporate).
 */

// ─────────────────────────────────────────────────────────────
// Document types
// ─────────────────────────────────────────────────────────────

export interface DocumentItem {
  id: number;
  source: "job" | "corporate" | "people" | "task";
  fileName: string;
  uiName: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string | null;
  folderPath: string | null;
  storagePath: string | null; // Full S3 key - SSoT for rename/download operations
  storageProvider: string | null;
  createdAt: string;
  // Job-specific
  jobId?: number;
  jobNumber?: string;
  jobTitle?: string;
  // Corporate-specific
  companyId?: number;
  companyName?: string;
  // People-specific
  contactId?: number;
  contactName?: string;
  // Task-specific
  taskId?: number;
  taskName?: string;
  taskNumber?: number;
  // Metadata
  documentTypeName?: string;
  isImage: boolean;
}

// ─────────────────────────────────────────────────────────────
// Tree node types
// ─────────────────────────────────────────────────────────────

export interface TreeNode {
  id: string;
  name: string;
  type: "category" | "parent" | "folder" | "file" | "loading" | "record" | "load-more";
  children?: TreeNode[];
  file?: DocumentItem;
  icon?: React.ReactNode;
  fileCount?: number;
  // SSoT: Full folder path from Entity Config
  fullPath?: string;
  // SSoT: Folder path template (e.g., "{{CompanyGroup}}/{{CompanyCode}}")
  pathTemplate?: string;
  // SSoT: Source type for WarehouseDocument queries (e.g., "task", "email", "job")
  sourceType?: string;
  // SSoT: Is this a virtual folder (has template tokens, loads from DB not S3)?
  isVirtual?: boolean;
  // Loading state progress
  progress?: { processed: number; total: number; percent: number; remaining_seconds?: number };
  // External link - when set, double-clicking folder navigates to this URL
  externalLink?: string;
  // Mailbox count - shown on Emails folder to indicate synced mailboxes
  mailboxCount?: number;
  // Mailbox folder - single-click opens drawer, double-click opens in new window
  isMailbox?: boolean;
  mailboxEmail?: string;
  // Record node (Feb 2026) - for showing actual database records
  recordNode?: RecordNode;
  // Warehouse type code for record nodes
  warehouseTypeCode?: string;
  // Load more callback for pagination
  onLoadMore?: () => void;
  // Email folder type for live_folder_tree drill-down ("mailbox" | "body" | "attachments")
  emailFolderType?: string;
}

export type TreeDisplayMode = "list" | "gallery";

// ─────────────────────────────────────────────────────────────
// Warehouse API types
// ─────────────────────────────────────────────────────────────

// NEW format: Warehouse type as top-level tree node (Feb 2026)
export interface WarehouseTypeTreeNode {
  id: string;  // "wt-job", "wt-corporate", etc.
  code: string;  // "job", "corporate", etc.
  displayName: string;
  iconName: string | null;
  orderPosition: number;
  folderPathTemplate: string | null;
  pathPreview?: string;
  fileCount: number;
  warehouseFolders: WarehouseFolderTreeNode2[];
}

export interface WarehouseFolderTreeNode2 {
  id: string;  // "wf-123"
  name: string;
  parentId: number | null;
  folderPathTemplate: string | null;
  pathPreview?: string;
  isSystem: boolean;
  isMailbox?: boolean;
  dynamicType?: string;
  children: WarehouseFolderChildNode[];
  warehouseFolder: {
    id: number;
    displayName: string;
    folderPath: string | null;
    iconName: string | null;
    uiName: string | null;
    downloadName: string | null;
  } | null;
}

export interface WarehouseFolderChildNode {
  id: string;  // "wfc-456"
  name: string;
  type: "category";
  iconName: string | null;
  warehouseType: string | null;
  folderPath: string | null;
  fullPath: string | null;
  fileCount: number;
  children: WarehouseFolderChildNode[];
}

// Database record node (Feb 2026)
// Represents actual jobs, contacts, corporate companies loaded on demand
export interface RecordNode {
  id: number;
  name: string;
  subtitle?: string;
  code?: string;
  tokenValues?: Record<string, string | null>;
}

// Pagination response from records API
export interface RecordsPagination {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

// ─────────────────────────────────────────────────────────────
// Warehouse tree mode - determines full vs scoped behavior
// ─────────────────────────────────────────────────────────────

export type WarehouseTreeMode =
  | { type: "full" }
  | {
      type: "scoped";
      linkableType: "Job" | "Contact" | "CorporateCompany";
      linkableId: number;
      warehouseTypeCode: string;
      recordTokenValues?: Record<string, string | null>;
    }
  | {
      type: "context";
      entityType: "Job" | "Contact" | "CorporateCompany";
      entityId: number;
    };

// ─────────────────────────────────────────────────────────────
// S3 folder data (shared between hook and renderer)
// ─────────────────────────────────────────────────────────────

export interface S3FolderEntry {
  name: string;
  path: string;
  count?: number;
  external_link?: string;
  mailbox_count?: number;
  expandable?: boolean;
  is_mailbox?: boolean;
  mailbox_email?: string;
  email_folder_type?: string;
}

export interface S3FileEntry {
  name: string;
  path: string;
  size: number;
  content_type: string;
  url?: string;
  id?: number;
  type?: string;
  warehouse_document_id?: number;
}

export interface S3FolderData {
  folders: S3FolderEntry[];
  files: S3FileEntry[];
  loading?: boolean;
  message?: string;
  progress?: { processed: number; total: number; percent: number; remaining_seconds?: number };
}

// SSoT: Scope folder names from WarehouseProvider
export interface ScopeFolders {
  job?: string;
  corporate?: string;
  people?: string;
  contact?: string;
  [key: string]: string | undefined;
}
