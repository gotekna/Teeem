"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronRight,
  Folder,
  FolderOpen,
  File,
  Image as ImageIcon,
  Search,
  List,
  LayoutGrid,
  FolderTree,
  ExternalLink,
  Briefcase,
  Building2,
  Users,
  User,
  Contact,
  RefreshCw,
  X,
  Maximize2,
  Download,
  CloudOff,
  Cloud,
  Monitor,
  Settings2,
  Check,
  Loader2,
  Warehouse,
  Mail,
  Paperclip,
  ClipboardList,
  FileText,
  Receipt,
  Package,
  MessageCircle,
  HardDrive,
  FileSpreadsheet,
  PenTool,
  Pencil,
  AlertTriangle,
  Link2,
  ArrowLeft,
  MessageSquare,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PDFViewer } from "@/components/ui/pdf-viewer";
import { WordDocumentPreview } from "@/components/ui/word-document-preview";
import { ExcelDocumentPreview } from "@/components/ui/excel-document-preview";
import { BackButton } from "@/components/ui/back-button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { uploadFile } from "@/lib/upload-utils";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { DocumentActions } from "@/components/documents/DocumentActions";
import { MailboxDrawer } from "@/components/documents/MailboxDrawer";
import { formatFileSize } from "@/utils/formatters";

// Types for API response
interface DocumentItem {
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

interface AllDocumentsResponse {
  success: boolean;
  data: {
    job_documents: DocumentItem[];
    corporate_documents: DocumentItem[];
    people_documents: DocumentItem[];
    task_documents: DocumentItem[];
  };
  // Counts for all scopes - dynamic, extends as new scopes are added
  counts: Record<string, number>;
}

// Tree node structure
interface TreeNode {
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
}

type ViewMode = "tree" | "list" | "gallery";
type TreeDisplayMode = "list" | "gallery";

// SSoT: Scope hierarchy item from /api/v1/documents/scope_hierarchy
// Matches WarehouseProvider.SCOPE_TEMPLATES structure
interface ScopeHierarchyItem {
  id: string;
  name: string;
  token: string; // Which template token this represents (CompanyGroup, CompanyCode, TabName, etc.)
  type: "folder";
  children?: ScopeHierarchyItem[];
  // Context IDs for fetching files
  companyId?: number;
  companyCode?: string;
  companyName?: string;
  jobId?: number;
  jobTitle?: string;
  contactId?: number;
  entityTabId?: number;
  fileCount?: number;
}

// Sync settings types
interface DesktopClient {
  id: number;
  deviceName: string;
  platform: string;
  lastSeenAt: string;
  isActive: boolean;
}

interface SyncExclusionRule {
  id: string;
  ruleType: "extension" | "size" | "pattern";
  value: string;
  action: "skip" | "include";
  description: string;
  isDefault: boolean;
  priority: number;
}

interface SyncCategory {
  key: string;
  name: string;
  description: string;
  extensions: string[];
  enabled: boolean;
}

interface SyncFolderScope {
  key: string;
  name: string;
  description: string;
  icon: string;
  warehouseType: string;
  folderPath: string | null;
  enabled: boolean;
}

interface SyncSubscription {
  id: string;
  folderName: string;
  folderType: string;
  lastSyncAt?: string;
}

// SSoT: Scope folder names from WarehouseProvider
interface ScopeFolders {
  job?: string;
  corporate?: string;
  people?: string;
  contact?: string;
  [key: string]: string | undefined;
}

// SSoT: Entity Tab structure from Entity Configurator
interface WarehouseTabFolder {
  id: number;
  display_name: string;
  scope: string;
  storage_folder_path: string | null;
  icon: string | null;
  is_enabled: boolean;
  document_count?: number;
  children?: WarehouseTabFolder[];
}

// SSoT: Warehouse folder tree from database (Feb 2026)
// OLD format - kept for backwards compatibility during migration
interface WarehouseTreeNode {
  id: string;
  name: string;
  type: "category";
  icon: string;
  warehouseType: string;
  folderPath: string | null;
  fullPath: string | null;
  fileCount: number;
  children: WarehouseTreeNode[];
}

// NEW format: Warehouse type as top-level tree node (Feb 2026)
interface WarehouseTypeTreeNode {
  id: string;  // "wt-job", "wt-corporate", etc.
  code: string;  // "job", "corporate", etc.
  displayName: string;
  iconName: string | null;
  orderPosition: number;
  folderPathTemplate: string | null;
  pathPreview?: string;
  fileCount: number;
  baseFolders: BaseFolderTreeNode[];
}

interface BaseFolderTreeNode {
  id: string;  // "bf-123"
  name: string;
  parentId: number | null;
  folderPathTemplate: string | null;
  pathPreview?: string;
  isSystem: boolean;
  children: WarehouseFolderTreeNode[];
  warehouseFolder: {
    id: number;
    displayName: string;
    folderPath: string | null;
    iconName: string | null;
    uiName: string | null;
    downloadName: string | null;
  } | null;
}

interface WarehouseFolderTreeNode {
  id: string;  // "wf-456"
  name: string;
  type: "category";
  iconName: string | null;
  warehouseType: string | null;
  folderPath: string | null;
  fullPath: string | null;
  fileCount: number;
  children: WarehouseFolderTreeNode[];
}

// Database record node (Feb 2026)
// Represents actual jobs, contacts, corporate companies loaded on demand
interface RecordNode {
  id: number;
  name: string;
  subtitle?: string;
  code?: string;
}

// Pagination response from records API
interface RecordsPagination {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

// Icon mapping for all storage scopes - matches WarehouseProvider.SCOPE_FOLDERS
const SCOPE_ICONS: Record<string, React.ReactNode> = {
  job: <Briefcase className="h-4 w-4" />,
  jobs: <Briefcase className="h-4 w-4" />,
  corporate: <Building2 className="h-4 w-4" />,
    company: <Building2 className="h-4 w-4" />,
  people: <Users className="h-4 w-4" />,
  users: <User className="h-4 w-4" />,
  user_photos: <ImageIcon className="h-4 w-4" />,
  user_contracts: <FileText className="h-4 w-4" />,
  my_docs: <FolderOpen className="h-4 w-4" />,
  contact: <Contact className="h-4 w-4" />,
  contacts: <Contact className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  emails: <Mail className="h-4 w-4" />,
  email_attachments: <Paperclip className="h-4 w-4" />,
  warehouse: <Warehouse className="h-4 w-4" />,
  warehousing: <Warehouse className="h-4 w-4" />,
  task: <ClipboardList className="h-4 w-4" />,
  tasks: <ClipboardList className="h-4 w-4" />,
  billinbox: <Receipt className="h-4 w-4" />,
  bill_inbox: <Receipt className="h-4 w-4" />,
  pricebook: <Package className="h-4 w-4" />,
  pricebook_photos: <Package className="h-4 w-4" />,
  chat: <MessageCircle className="h-4 w-4" />,
  active_storage: <HardDrive className="h-4 w-4" />,
  attachments: <Paperclip className="h-4 w-4" />,
  templates: <FileText className="h-4 w-4" />,
  bank_statements: <FileSpreadsheet className="h-4 w-4" />,
  contracts: <PenTool className="h-4 w-4" />,
};

// SSoT: Build hierarchical tree from WarehouseProvider.scope_folders
// This matches the tree structure shown in SharePointTab (Storage Configurator)
// Both components use the same backend data source for consistency
// Note: rootPath is provider-agnostic - "/" for S3/Wasabi, "/Shared Documents" for SharePoint
const buildScopeTree = (
  scopes: Record<string, string>,
  counts: Record<string, number>,
  templates: Record<string, string> = {},
  rootPath: string = ""
): TreeNode[] => {
  const tree: TreeNode[] = [];

  // Sort entries by path for consistent tree building (shorter paths first)
  const entries = Object.entries(scopes).sort(([, a], [, b]) => a.localeCompare(b));

  // Build tree structure - paths like "Users/Photos" become children of "Users"
  entries.forEach(([scopeKey, path]) => {
    if (!path) return;

    const parts = path.split('/').filter(Boolean);
    let current = tree;
    let currentPath = '';

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLeaf = index === parts.length - 1;

      // Look for existing node at this level
      let node = current.find(n => n.name === part);

      if (!node) {
        // Map scope key to count key for proper count display
        const countKey = isLeaf ? (
          scopeKey === "job" ? "jobs"
          : scopeKey === "corporate" ? "corporate"
          : scopeKey === "email" ? "emails"
          : scopeKey === "email_attachments" ? "email_attachments"
          : scopeKey === "task" ? "tasks"
          : scopeKey === "pricebook_photos" ? "pricebook_images"
          : scopeKey
        ) : null;

        // Get template for this scope (SSoT from Entity Config)
        const template = isLeaf ? templates[scopeKey] || "" : "";
        // Build full path: rootPath + scopePath + template
        const fullPath = template
          ? `${rootPath}/${currentPath}/${template}`
          : `${rootPath}/${currentPath}`;

        node = {
          id: isLeaf ? scopeKey : `parent-${currentPath.replace(/\//g, "-").toLowerCase()}`,
          name: part,
          type: "category" as const,
          icon: isLeaf ? (SCOPE_ICONS[scopeKey] || <Folder className="h-4 w-4" />) : <Folder className="h-4 w-4" />,
          fileCount: countKey ? (counts[countKey] || 0) : 0,
          children: [],
          fullPath: isLeaf ? fullPath : `${rootPath}/${currentPath}`,
          pathTemplate: isLeaf && template ? template : undefined,
        };
        current.push(node);
      } else if (isLeaf && node.id.startsWith('parent-')) {
        // This path is a scope folder but was created as intermediate parent - upgrade it
        const countKey = scopeKey === "job" ? "jobs"
          : scopeKey === "corporate" ? "corporate"
          : scopeKey === "email" ? "emails"
          : scopeKey === "email_attachments" ? "email_attachments"
          : scopeKey === "task" ? "tasks"
          : scopeKey === "pricebook_photos" ? "pricebook_images"
          : scopeKey;
        const template = templates[scopeKey] || "";
        const fullPath = template
          ? `${rootPath}/${currentPath}/${template}`
          : `${rootPath}/${currentPath}`;

        node.id = scopeKey;
        node.icon = SCOPE_ICONS[scopeKey] || node.icon;
        node.fileCount = counts[countKey] || 0;
        node.fullPath = fullPath;
        node.pathTemplate = template || undefined;
      }

      current = node.children || [];
    });
  });

  // Second pass: aggregate child counts to parents
  const aggregateCounts = (nodes: TreeNode[]): number => {
    return nodes.reduce((sum, node) => {
      const childCount = node.children ? aggregateCounts(node.children) : 0;
      // Only aggregate if this is a parent folder (not a scope with its own count)
      if (node.id.startsWith('parent-')) {
        node.fileCount = childCount;
      }
      return sum + (node.fileCount || 0);
    }, 0);
  };
  aggregateCounts(tree);

  return tree;
};

export default function AllDocumentsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [treeDisplayMode, setTreeDisplayMode] = useState<TreeDisplayMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["wt-job", "wt-corporate", "wt-contact"]));
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<{
    jobs: DocumentItem[];
    corporate: DocumentItem[];
    people: DocumentItem[];
    tasks: DocumentItem[];
  }>({ jobs: [], corporate: [], people: [], tasks: [] });
  // Counts for all scopes - matches WarehouseProvider.SCOPE_FOLDERS
  const [counts, setCounts] = useState<Record<string, number>>({
    jobs: 0, corporate: 0, people: 0, contacts: 0,
    emails: 0, attachments: 0, email_attachments: 0,
    users: 0, user_photos: 0, user_contracts: 0, my_docs: 0,
    warehousing: 0, tasks: 0, bill_inbox: 0, pricebook_photos: 0, pricebook_images: 0, chat: 0,
    templates: 0, bank_statements: 0, contracts: 0,
    active_storage: 0, total: 0
  });
  // Document preview popup state
  const [previewDocument, setPreviewDocument] = useState<DocumentItem | null>(null);
  // Click timer for single/double click differentiation
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isRenameSaving, setIsRenameSaving] = useState(false);

  // Link to Task dialog state (for orphaned documents)
  const [showLinkToTaskDialog, setShowLinkToTaskDialog] = useState(false);
  const [linkToTaskSearch, setLinkToTaskSearch] = useState("");
  const [linkToTaskResults, setLinkToTaskResults] = useState<Array<{ id: number; name: string; task_number: number }>>([]);
  const [isLinkingToTask, setIsLinkingToTask] = useState(false);
  // Two-step flow: selected task and its questions
  const [selectedTaskForLink, setSelectedTaskForLink] = useState<{
    id: number;
    name: string;
    task_number: number;
    action_items: Array<{
      id: number;
      text: string;
      item_type: string;
      attachments: Array<{ attachable_id: number }>;
    }>;
  } | null>(null);
  const [isLoadingTaskQuestions, setIsLoadingTaskQuestions] = useState(false);

  // Mailbox drawer state - single-click on mailbox folder opens drawer
  const [mailboxDrawerOpen, setMailboxDrawerOpen] = useState(false);
  const [selectedMailbox, setSelectedMailbox] = useState<string | null>(null);
  // Double-click timer for mailbox folders
  const mailboxClickTimerRef = useRef<NodeJS.Timeout | null>(null);

  // SSoT: Scope folder names from WarehouseProvider
  // Start empty - API will provide all scopes from WarehouseProvider.SCOPE_FOLDERS
  const [scopeFolders, setScopeFolders] = useState<ScopeFolders>({});

  // SSoT: Folder path templates from Entity Config
  const [scopeTemplates, setScopeTemplates] = useState<Record<string, string>>({});

  // SSoT: Root path from WarehouseProvider
  // Default to empty string - will be populated from API
  // For S3: "/" (bucket root), for SharePoint: "/Shared Documents"
  const [rootPath, setRootPath] = useState<string>("");
  // Phase 4: Virtual scopes (render from DB instead of S3)
  const [virtualScopes, setVirtualScopes] = useState<Record<string, boolean>>({});

  // SSoT: All configured folders from Entity Configurator
  const [entityFolders, setEntityFolders] = useState<{
    job: WarehouseTabFolder[];
    corporate: WarehouseTabFolder[];
    contact: WarehouseTabFolder[];
  }>({ job: [], corporate: [], contact: [] });

  // SSoT: Scope hierarchies from /api/v1/documents/scope_hierarchy
  // These match WarehouseProvider.SCOPE_TEMPLATES ({{CompanyGroup}}/{{CompanyCode}}/{{TabName}})
  const [scopeHierarchies, setScopeHierarchies] = useState<{
    corporate: ScopeHierarchyItem[];
    job: ScopeHierarchyItem[];
    people: ScopeHierarchyItem[];
  }>({ corporate: [], job: [], people: [] });

  // SSoT: Warehouse types tree from database (Feb 2026)
  // This is THE source of truth for folder structure - warehouse_types as top level
  const [warehouseTypesTree, setWarehouseTypesTree] = useState<WarehouseTypeTreeNode[]>([]);
  const [warehouseTreeLoading, setWarehouseTreeLoading] = useState(true);

  // Records per warehouse type (Feb 2026) - loaded on demand when expanding warehouse type
  // Key is warehouse type code (e.g., "job", "contact", "corporate")
  const [warehouseRecords, setWarehouseRecords] = useState<Record<string, {
    records: RecordNode[];
    pagination: RecordsPagination;
  }>>({});
  const [loadingRecords, setLoadingRecords] = useState<Set<string>>(new Set());

  // SSoT: S3 folder contents - loaded lazily when expanding folders
  // This mirrors the exact Wasabi/S3 folder structure for OneDrive-like browsing
  const [s3Folders, setS3Folders] = useState<Record<string, {
    folders: Array<{ name: string; path: string; count?: number; external_link?: string; mailbox_count?: number; expandable?: boolean; is_mailbox?: boolean; mailbox_email?: string }>;
    files: Array<{ name: string; path: string; size: number; content_type: string; url?: string; id?: number; type?: string; warehouse_document_id?: number }>;
    loading?: boolean;
    message?: string;
    progress?: { processed: number; total: number; percent: number; remaining_seconds?: number };
  }>>({});
  const [loadingS3Folders, setLoadingS3Folders] = useState<Set<string>>(new Set());

  // Sync settings state
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [desktopClients, setDesktopClients] = useState<DesktopClient[]>([]);
  const [exclusionRules, setExclusionRules] = useState<SyncExclusionRule[]>([]);
  const [subscriptions, setSubscriptions] = useState<SyncSubscription[]>([]);
  const [userOverrides, setUserOverrides] = useState<Record<string, boolean>>({});
  const [syncCategories, setSyncCategories] = useState<SyncCategory[]>([]);
  const [folderScopes, setFolderScopes] = useState<SyncFolderScope[]>([]);

  // Background job progress state
  const [activeJob, setActiveJob] = useState<{
    job_type: string;
    scope: string | null;
    status: string;
    total_items: number;
    processed_items: number;
    progress_percent: number;
    current_item: string | null;
    message: string | null;
    elapsed_time: string | null;
    estimated_remaining: number | null;
    metadata?: {
      old_template?: string;
      new_template?: string;
      dry_run?: boolean;
    };
  } | null>(null);

  // Drag-and-drop upload state
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const dragCounterRef = useRef(0);

  // Folder files state - tracks loaded files for each folder path
  const [folderFiles, setFolderFiles] = useState<Record<string, DocumentItem[]>>({});
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());

  // SSoT: Fetch storage config from WarehouseProvider (scope folders, templates, root path)
  // This uses the same endpoint as WarehouseProviderTab to ensure consistency
  // NOTE: Endpoint name "sharepoint" is legacy - it returns provider-agnostic config from WarehouseProvider
  useEffect(() => {
    const fetchStorageConfig = async () => {
      try {
        const response = await api.get<{
          success: boolean;
          data: {
            scope_folders?: ScopeFolders;
            scope_templates?: Record<string, string>;
            root_path?: string;
            virtual_warehouses?: Record<string, boolean>;  // Phase 4
          };
        }>("/api/v1/warehouse_provider");
        if (response?.success && response.data) {
          // SSoT: Use scope_folders from WarehouseProvider.SCOPE_FOLDERS
          if (response.data.scope_folders) {
            setScopeFolders(response.data.scope_folders);
          }
          if (response.data.scope_templates) {
            setScopeTemplates(response.data.scope_templates);
          }
          if (response.data.root_path) {
            setRootPath(response.data.root_path);
          }
          // Phase 4: Virtual warehouses from WarehouseProvider
          if (response.data.virtual_warehouses) {
            setVirtualScopes(response.data.virtual_warehouses);
          }
        }
      } catch (err) {
        console.error("Failed to fetch storage config:", err);
      }
    };
    fetchStorageConfig();
  }, []);

  // SSoT: Fetch folder tree from warehouse_types table (Feb 2026)
  // This is THE source of truth for folder structure - warehouse types as top level
  useEffect(() => {
    const fetchWarehouseTypesTree = async () => {
      setWarehouseTreeLoading(true);
      try {
        const response = await api.get<{
          success: boolean;
          data: {
            tree: WarehouseTypeTreeNode[];
            counts: Record<string, number>;
            total: number;
          };
        }>("/api/v1/warehouse_types/tree");

        if (response?.success && response.data) {
          setWarehouseTypesTree(response.data.tree);
          // Update counts from the API response
          if (response.data.counts) {
            setCounts(prev => ({ ...prev, ...response.data.counts, total: response.data.total }));
          }
        }
      } catch (err) {
        console.error("Failed to fetch warehouse types tree:", err);
      } finally {
        setWarehouseTreeLoading(false);
      }
    };
    fetchWarehouseTypesTree();
  }, []);

  // SSoT: Fetch all configured folders from Entity Configurator
  useEffect(() => {
    const fetchEntityFolders = async () => {
      try {
        // Fetch folders for all scopes in parallel
        const [jobRes, corpRes, contactRes] = await Promise.all([
          api.get<{ success: boolean; data: { tabs: WarehouseTabFolder[] } }>("/api/v1/warehouse_folders?scope=job&include_disabled=false"),
          api.get<{ success: boolean; data: { tabs: WarehouseTabFolder[] } }>("/api/v1/warehouse_folders?scope=corporate&include_disabled=false"),
          api.get<{ success: boolean; data: { tabs: WarehouseTabFolder[] } }>("/api/v1/warehouse_folders?scope=contact&include_disabled=false"),
        ]);

        setEntityFolders({
          job: jobRes?.success && jobRes.data?.tabs ? jobRes.data.tabs : [],
          corporate: corpRes?.success && corpRes.data?.tabs ? corpRes.data.tabs : [],
          contact: contactRes?.success && contactRes.data?.tabs ? contactRes.data.tabs : [],
        });
      } catch (err) {
        console.error("Failed to fetch entity folders:", err);
      }
    };
    fetchEntityFolders();
  }, []);

  // SSoT: Fetch scope hierarchies from /api/v1/documents/scope_hierarchy
  // These hierarchies match WarehouseProvider.SCOPE_TEMPLATES
  // Structure: CompanyGroup → CompanyCode → TabName (for corporate)
  useEffect(() => {
    const fetchScopeHierarchies = async () => {
      try {
        // Fetch hierarchies for all scopes in parallel
        const [corpRes, jobRes, peopleRes] = await Promise.all([
          api.get<{ success: boolean; scope: string; template: string; hierarchy: ScopeHierarchyItem[] }>(
            "/api/v1/documents/scope_hierarchy?scope=corporate"
          ),
          api.get<{ success: boolean; scope: string; template: string; hierarchy: ScopeHierarchyItem[] }>(
            "/api/v1/documents/scope_hierarchy?scope=job"
          ),
          api.get<{ success: boolean; scope: string; template: string; hierarchy: ScopeHierarchyItem[] }>(
            "/api/v1/documents/scope_hierarchy?scope=people"
          ),
        ]);

        setScopeHierarchies({
          corporate: corpRes?.success && corpRes.hierarchy ? corpRes.hierarchy : [],
          job: jobRes?.success && jobRes.hierarchy ? jobRes.hierarchy : [],
          people: peopleRes?.success && peopleRes.hierarchy ? peopleRes.hierarchy : [],
        });
      } catch (err) {
        console.error("Failed to fetch scope hierarchies:", err);
      }
    };
    fetchScopeHierarchies();
  }, []);

  // Fetch all documents
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<AllDocumentsResponse>("/api/v1/documents/all");
      if (response.success && response.data) {
        setDocuments({
          jobs: response.data.job_documents || [],
          corporate: response.data.corporate_documents || [],
          people: response.data.people_documents || [],
          tasks: response.data.task_documents || [],
        });
        // Merge API counts with defaults - API now returns all scope counts
        setCounts(prev => ({ ...prev, ...response.counts }));
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Fetch files for a specific folder from S3 or database
  const fetchFolderFiles = useCallback(async (folderPath: string, scopeKey: string) => {
    // Already loaded or loading
    if (folderFiles[scopeKey] || loadingFolders.has(scopeKey)) return;

    setLoadingFolders(prev => new Set(prev).add(scopeKey));
    try {
      // SSoT: Check if this is an EntityTab folder (job-folder, corp-folder, contact-folder)
      // Pattern: {scope}-folder-{EntityTab.id}
      const entityTabFolderMatch = scopeKey.match(/^(job|corp|contact)-folder-(\d+)$/);

      if (entityTabFolderMatch) {
        // Fetch documents from database by EntityTab ID
        const [, scopePrefix, entityTabId] = entityTabFolderMatch;
        // Map prefix to backend scope
        const scope = scopePrefix === "corp" ? "corporate" : scopePrefix;

        const response = await api.get<{
          success: boolean;
          files: Array<{
            name: string;
            path: string;
            size: number;
            last_modified: string;
            url: string;
            content_type: string;
            id: number;
            // Corporate fields
            company_name?: string;
            company_code?: string;
            // Job fields
            job_id?: number;
            job_number?: string;
            job_title?: string;
            // Contact fields
            contact_id?: number;
            contact_name?: string;
          }>;
          folder: string;
          scope: string;
          count: number;
        }>(`/api/v1/documents/folder_files?entity_tab_id=${entityTabId}&scope=${scope}`);

        if (response?.success && response.files) {
          const docs: DocumentItem[] = response.files.map((file) => ({
            id: file.id,
            source: scope as "job" | "corporate" | "people",
            fileName: file.name,
            uiName: file.name,
            mimeType: file.content_type || "",
            fileSize: file.size || 0,
            fileUrl: file.url,
            folderPath: file.path,
            storagePath: file.path,
            storageProvider: scope === "job" ? "sharepoint" : "sharepoint",
            createdAt: file.last_modified || new Date().toISOString(),
            isImage: /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name),
            // Scope-specific fields
            companyName: file.company_name,
            companyCode: file.company_code,
            jobId: file.job_id,
            jobNumber: file.job_number,
            jobTitle: file.job_title,
            contactId: file.contact_id,
            contactName: file.contact_name,
          }));
          setFolderFiles(prev => ({ ...prev, [scopeKey]: docs }));
        }
      } else {
        // Standard S3 folder fetch
        // Strip template variables from path (e.g., {{UserName}}/{{Year}})
        const cleanPath = folderPath.replace(/\/?\{\{[^\}]+\}\}/g, "").replace(/\/+$/, "");

        // Use recursive for warehouse folders (files are nested in user/year subfolders)
        const isWarehouseFolder = cleanPath.startsWith("Warehousing");
        const recursive = isWarehouseFolder ? "&recursive=true" : "";

        // Use full path parameter for S3 lookup
        const response = await api.get<{
          success: boolean;
          files: Array<{
            name: string;
            path: string;
            size: number;
            last_modified: string;
            url: string;
            content_type: string;
          }>;
          folder: string;
          path: string;
          count: number;
        }>(`/api/v1/documents/user_files?path=${encodeURIComponent(cleanPath)}${recursive}`);

        if (response?.success && response.files) {
          // Convert S3 files to DocumentItem format
          const docs: DocumentItem[] = response.files.map((file, idx) => ({
            id: idx + 1,
            source: "corporate" as const, // Generic source for user files
            fileName: file.name,
            uiName: file.name,
            mimeType: file.content_type || "",
            fileSize: file.size || 0,
            fileUrl: file.url,
            folderPath: file.path,
            storagePath: file.path,  // S3 key for rename operations
            storageProvider: "s3_compatible",
            createdAt: file.last_modified || new Date().toISOString(),
            isImage: /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name),
          }));
          setFolderFiles(prev => ({ ...prev, [scopeKey]: docs }));
        }
      }
    } catch (err) {
      console.error(`Failed to fetch files for ${folderPath}:`, err);
      // Set empty array to prevent re-fetching
      setFolderFiles(prev => ({ ...prev, [scopeKey]: [] }));
    } finally {
      setLoadingFolders(prev => {
        const next = new Set(prev);
        next.delete(scopeKey);
        return next;
      });
    }
  }, [folderFiles, loadingFolders]);

  // Phase 4: Helper to determine scope from a folder path
  // Maps paths like "Emails", "Emails/robert@tekna.com.au" to scope key "email"
  const getScopeFromPath = useCallback((path: string): string | null => {
    if (!path) return null;

    // Get the first segment of the path (e.g., "Emails" from "Emails/robert@tekna.com.au/...")
    const firstSegment = path.split('/')[0];

    // Collect ALL matching scope keys, then prefer the simplest one
    // Multiple keys can map to the same folder (e.g., "email", "email-attachments", "emails" all map to "Emails")
    // We want the base scope key (shortest, no hyphens/underscores) for virtualScopes lookup
    const matchingKeys: string[] = [];
    for (const [scopeKey, scopePath] of Object.entries(scopeFolders)) {
      if (scopePath && (scopePath === firstSegment || scopePath.startsWith(firstSegment + '/'))) {
        matchingKeys.push(scopeKey);
      }
    }

    if (matchingKeys.length === 0) return null;

    // Prefer the simplest key (shortest, without hyphens/underscores)
    // This ensures "email" is preferred over "email-attachments" or "email_attachments"
    return matchingKeys.sort((a, b) => {
      const aSimple = !a.includes('-') && !a.includes('_');
      const bSimple = !b.includes('-') && !b.includes('_');
      if (aSimple !== bSimple) return aSimple ? -1 : 1;
      return a.length - b.length;
    })[0];
  }, [scopeFolders]);

  // SSoT: Fetch folders - routes to virtual_tree for virtual scopes, s3_folders for physical
  // This is used for OneDrive-like folder browsing
  const fetchS3Folders = useCallback(async (path: string, forceRefresh: boolean = false) => {
    // Already loaded (and not in loading state) or currently fetching
    const existingData = s3Folders[path];
    if (!forceRefresh && existingData && !existingData.loading) {
      return; // Already have data, don't re-fetch
    }
    if (loadingS3Folders.has(path)) {
      return; // Currently fetching, don't duplicate
    }

    setLoadingS3Folders(prev => new Set(prev).add(path));
    try {
      // Phase 4: Check if this path belongs to a virtual scope
      const scope = getScopeFromPath(path);
      const isVirtual = scope && virtualScopes[scope];

      if (isVirtual && scope) {
        // Phase 5: Use live_folder_tree - computes folder structure from DB relationships
        // Benefits: Instant template changes, always accurate, single GROUP BY query per level
        // LIM (Jan 2026): scopeFolders now contains simple root folders (e.g., "Contacts")
        const scopeRootFolder = scopeFolders[scope] || '';
        const relativePath = path.startsWith(scopeRootFolder + '/')
          ? path.slice(scopeRootFolder.length + 1)
          : (path === scopeRootFolder ? '' : path);

        const response = await api.get<{
          success: boolean;
          path: string;
          scope: string;
          template?: string;
          folders: Array<{ name: string; path: string; count: number; [key: string]: unknown }>;
          files: Array<{
            id: number;
            uiName: string;  // FRC: API returns uiName (renamed from displayName Feb 2026)
            originalFilename?: string;
            type: string;
            mimeType: string;
            fileSize?: number;
            createdAt?: string;
            receivedAt?: string;
            fileUrl?: string | null;  // FRC: API returns fileUrl, not url
            [key: string]: unknown;
          }>;
          count: { folders: number; files: number; total: number };
        }>(`/api/v1/documents/live_folder_tree?scope=${encodeURIComponent(scope)}&path=${encodeURIComponent(relativePath)}`);

        if (response?.success) {
          // Map live_folder_tree response to s3_folders format for UI compatibility
          // FRC (Jan 2026): Use scopeRootFolder for path building, not full template
          setS3Folders(prev => ({
            ...prev,
            [path]: {
              folders: (response.folders || []).map(f => ({
                name: f.name,
                // Prepend scope ROOT folder to make full path (e.g., "Contacts/2Code Fire & Build/Licenses")
                path: scopeRootFolder ? `${scopeRootFolder}/${f.path}` : f.path,
                count: f.count,
              })),
              files: (response.files || []).map(f => ({
                // FRC (Feb 2026): API returns uiName (renamed from displayName)
                name: f.uiName || f.originalFilename || 'Unknown',
                path: relativePath ? `${scopeRootFolder}/${relativePath}/${f.uiName || f.originalFilename}` : `${scopeRootFolder}/${f.uiName || f.originalFilename}`,
                size: f.fileSize || 0,
                content_type: f.mimeType || 'application/octet-stream',
                url: f.fileUrl ?? undefined,  // FRC: API returns fileUrl (null → undefined for type compat)
                id: f.id,
                type: f.type,
              })),
            },
          }));
        }
      } else {
        // Physical scope: Use S3/Wasabi folder listing (now uses virtual folders from WarehouseDocument)
        const response = await api.get<{
          success: boolean;
          loading?: boolean;
          message?: string;
          progress?: { processed: number; total: number; percent: number; remaining_seconds?: number };
          path: string;
          folders: Array<{ name: string; path: string }>;
          files: Array<{ name: string; path: string; size: number; content_type: string; last_modified?: string; url?: string; id?: number; warehouse_document_id?: number }>;
          count: { folders: number; files: number; total: number };
        }>(`/api/v1/documents/s3_folders?path=${encodeURIComponent(path)}`);

        if (response?.success) {
          if (response.loading) {
            // Index is being built - store loading state and poll for updates
            setS3Folders(prev => ({
              ...prev,
              [path]: {
                folders: [],
                files: [],
                loading: true,
                message: response.message,
                progress: response.progress,
              },
            }));
            // Poll again in 2 seconds
            setTimeout(() => {
              setLoadingS3Folders(prev => {
                const next = new Set(prev);
                next.delete(path); // Allow re-fetch
                return next;
              });
              fetchS3Folders(path, true); // Force refresh to get updated progress
            }, 2000);
            return; // Don't clear loading state yet
          }
          setS3Folders(prev => ({
            ...prev,
            [path]: {
              folders: response.folders || [],
              files: response.files || [],
            },
          }));
        }
      }
    } catch (err) {
      console.error(`Failed to fetch folders for ${path}:`, err);
      // Set empty to prevent re-fetching
      setS3Folders(prev => ({
        ...prev,
        [path]: { folders: [], files: [] },
      }));
    } finally {
      setLoadingS3Folders(prev => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    }
  }, [s3Folders, loadingS3Folders, getScopeFromPath, virtualScopes, scopeFolders]);

  // NOTE (Feb 2026): S3 root folder fetch removed - using warehouse_folders/tree instead
  // S3 folders are now only fetched when user expands a folder to see files

  // Fetch records for a warehouse type (Feb 2026)
  // Called when user expands a warehouse type node in the tree
  const fetchRecords = useCallback(async (warehouseTypeCode: string, offset = 0) => {
    // Skip if already loading or already have data (unless loading more)
    if (loadingRecords.has(warehouseTypeCode) && offset === 0) return;
    if (offset === 0 && warehouseRecords[warehouseTypeCode]) return;

    setLoadingRecords(prev => new Set(prev).add(warehouseTypeCode));
    try {
      const response = await api.get<{
        success: boolean;
        data: {
          records: RecordNode[];
          pagination: RecordsPagination;
        };
      }>(`/api/v1/warehouse_types/${warehouseTypeCode}/records`, {
        params: { limit: 50, offset }
      });

      if (response?.success && response.data) {
        setWarehouseRecords(prev => ({
          ...prev,
          [warehouseTypeCode]: {
            records: offset === 0
              ? response.data.records
              : [...(prev[warehouseTypeCode]?.records || []), ...response.data.records],
            pagination: response.data.pagination
          }
        }));
      }
    } catch (err) {
      console.error(`Failed to fetch records for ${warehouseTypeCode}:`, err);
      // Set empty to prevent re-fetching
      if (offset === 0) {
        setWarehouseRecords(prev => ({
          ...prev,
          [warehouseTypeCode]: { records: [], pagination: { total: 0, limit: 50, offset: 0, has_more: false } }
        }));
      }
    } finally {
      setLoadingRecords(prev => {
        const next = new Set(prev);
        next.delete(warehouseTypeCode);
        return next;
      });
    }
  }, [loadingRecords, warehouseRecords]);

  // FRC (Feb 2026): Fetch records for initially-expanded warehouse types on mount
  // Without this, warehouse types like "Job" that are expanded by default won't
  // load their records because handleTreeNodeExpand is never triggered
  useEffect(() => {
    // Only run once on mount, after warehouse tree is loaded
    if (!warehouseTreeLoading && warehouseTypesTree.length > 0) {
      // Get initially expanded warehouse types (those starting with "wt-")
      const initiallyExpandedTypes = Array.from(expandedFolders)
        .filter(id => id.startsWith("wt-"))
        .map(id => id.replace("wt-", ""))
        .filter(code => code !== "email"); // Email doesn't have record folders

      // Fetch records for each expanded type
      initiallyExpandedTypes.forEach(code => {
        if (!warehouseRecords[code]) {
          fetchRecords(code);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseTreeLoading, warehouseTypesTree.length]);

  // Poll for active background jobs (folder reorganization)
  useEffect(() => {
    const pollJobProgress = async () => {
      try {
        const response = await api.get<{
          success: boolean;
          active: boolean;
          data: typeof activeJob;
        }>("/api/v1/background_jobs/progress/folder_reorganization");

        if (response?.success && response.active && response.data) {
          setActiveJob(response.data);
        } else {
          // If job just completed, refresh documents
          if (activeJob && !response?.active) {
            fetchDocuments();
          }
          setActiveJob(null);
        }
      } catch (err) {
        // Silent fail - job tracking is optional
        console.debug("Failed to fetch job progress:", err);
      }
    };

    // Poll immediately on mount
    pollJobProgress();

    // Poll every 2 seconds while active, every 10 seconds otherwise
    const intervalMs = activeJob ? 2000 : 10000;
    const interval = setInterval(pollJobProgress, intervalMs);

    return () => clearInterval(interval);
  }, [activeJob, fetchDocuments]);

  // Drag-and-drop upload handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(`Uploading ${files.length} file${files.length > 1 ? "s" : ""}...`);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`Uploading ${i + 1}/${files.length}: ${file.name}`);

        // SSoT: Use presigned URL upload (bypasses Heroku 30s timeout)
        const result = await uploadFile(file, 'documents', {
          metadata: { folder: "MyDocs" }
        });

        if (!result.success) {
          throw new Error(result.error || "Upload failed");
        }
      }

      setUploadProgress("Upload complete!");
      // Clear folder files cache so new files show when expanding
      setFolderFiles({});
      // Refresh document list
      await fetchDocuments();

      // Clear message after 2 seconds
      setTimeout(() => setUploadProgress(null), 2000);
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadProgress(`Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      setTimeout(() => setUploadProgress(null), 3000);
    } finally {
      setIsUploading(false);
    }
  }, [fetchDocuments]);

  // Fetch sync settings when modal opens
  // Note: These endpoints require desktop client auth (not web auth)
  // We use skipAuthRedirect to prevent 401 from logging the user out
  // A 401 here means "no desktop app connected", not "session expired"
  const fetchSyncSettings = useCallback(async () => {
    setSyncLoading(true);
    try {
      // Fetch file type categories (opt-in sync)
      const categoriesRes = await api.get<{ success: boolean; data: { categories?: SyncCategory[] } }>(
        "/api/v1/sync/categories",
        { skipAuthRedirect: true }
      );
      if (categoriesRes?.success && categoriesRes.data?.categories) {
        setSyncCategories(categoriesRes.data.categories);
      }

      // Fetch folder scopes (opt-in sync for Office 365 folders)
      const folderScopesRes = await api.get<{ success: boolean; data: { folder_scopes?: SyncFolderScope[] } }>(
        "/api/v1/sync/folder_scopes",
        { skipAuthRedirect: true }
      );
      if (folderScopesRes?.success && folderScopesRes.data?.folder_scopes) {
        setFolderScopes(folderScopesRes.data.folder_scopes);
      }

      // Fetch exclusion rules (legacy, for backwards compat)
      const exclusionsRes = await api.get<{ success: boolean; data: { rules?: SyncExclusionRule[] } }>(
        "/api/v1/sync/exclusions",
        { skipAuthRedirect: true }
      );
      if (exclusionsRes?.success && exclusionsRes.data?.rules) {
        setExclusionRules(exclusionsRes.data.rules);
        // Build user overrides map
        const overrides: Record<string, boolean> = {};
        exclusionsRes.data.rules.forEach((rule) => {
          if (!rule.isDefault) {
            overrides[`${rule.ruleType}:${rule.value}`] = rule.action === "include";
          }
        });
        setUserOverrides(overrides);
      }

      // Fetch subscriptions (what folders are being synced)
      const subsRes = await api.get<{ success: boolean; data: SyncSubscription[] }>(
        "/api/v1/sync/subscriptions",
        { skipAuthRedirect: true }
      );
      if (subsRes?.success && subsRes.data) {
        setSubscriptions(subsRes.data);
      }

      // Note: /api/v1/sync/clients endpoint doesn't exist yet
      // Desktop clients would need a web-accessible endpoint
      // For now, we leave desktopClients empty and show "No clients" message
    } catch (error) {
      // Expected to fail if no desktop app connected (401)
      // Just log and continue - the UI will show empty state
      console.log("Sync settings not available (no desktop app connected):", error);
    } finally {
      setSyncLoading(false);
    }
  }, []);

  // Handle opening sync settings
  const handleOpenSyncSettings = useCallback(() => {
    setShowSyncSettings(true);
    fetchSyncSettings();
  }, [fetchSyncSettings]);

  // Toggle exclusion rule
  const handleToggleExclusion = useCallback(async (rule: SyncExclusionRule) => {
    const key = `${rule.ruleType}:${rule.value}`;
    const currentlyIncluded = userOverrides[key] ?? (rule.action === "include");
    const newValue = !currentlyIncluded;

    // Optimistic update
    setUserOverrides((prev) => ({
      ...prev,
      [key]: newValue,
    }));

    try {
      await api.put("/api/v1/sync/exclusions", {
        rule_id: rule.id,
        action: newValue ? "include" : "skip",
      });
    } catch (error) {
      console.error("Failed to update exclusion:", error);
      // Revert on error
      setUserOverrides((prev) => ({
        ...prev,
        [key]: !newValue,
      }));
    }
  }, [userOverrides]);

  // Handle download desktop app
  const handleDownloadDesktopApp = useCallback(() => {
    setShowDownloadModal(true);
  }, []);

  // Toggle a file type category
  const handleToggleCategory = useCallback(async (categoryKey: string, enabled: boolean) => {
    // Optimistic update
    setSyncCategories((prev) =>
      prev.map((cat) => (cat.key === categoryKey ? { ...cat, enabled } : cat))
    );

    try {
      await api.put(`/api/v1/sync/categories/${categoryKey}`, { enabled });
    } catch (error) {
      console.error("Failed to update category:", error);
      // Revert on error
      setSyncCategories((prev) =>
        prev.map((cat) => (cat.key === categoryKey ? { ...cat, enabled: !enabled } : cat))
      );
    }
  }, []);

  // Toggle a folder scope
  const handleToggleFolderScope = useCallback(async (scopeKey: string, enabled: boolean) => {
    // Optimistic update
    setFolderScopes((prev) =>
      prev.map((scope) => (scope.key === scopeKey ? { ...scope, enabled } : scope))
    );

    try {
      await api.put(`/api/v1/sync/folder_scopes/${scopeKey}`, { enabled });
    } catch (error) {
      console.error("Failed to update folder scope:", error);
      // Revert on error
      setFolderScopes((prev) =>
        prev.map((scope) => (scope.key === scopeKey ? { ...scope, enabled: !enabled } : scope))
      );
    }
  }, []);

  // Download specific platform
  const handleDownloadPlatform = useCallback((platform: "mac" | "windows") => {
    // TODO: Replace with actual download URLs when hosted
    const downloadUrls = {
      mac: "/downloads/TEEEM-Sync.dmg",
      windows: "/downloads/TEEEM-Sync-Setup.exe",
    };
    window.open(downloadUrls[platform], "_blank");
  }, []);

  // Filter documents by search query
  const filteredDocuments = useMemo(() => {
    if (!searchQuery) return documents;
    const query = searchQuery.toLowerCase();
    return {
      jobs: documents.jobs.filter(d =>
        d.fileName?.toLowerCase().includes(query) ||
        d.uiName?.toLowerCase().includes(query) ||
        d.jobTitle?.toLowerCase().includes(query)
      ),
      corporate: documents.corporate.filter(d =>
        d.fileName?.toLowerCase().includes(query) ||
        d.uiName?.toLowerCase().includes(query) ||
        d.companyName?.toLowerCase().includes(query)
      ),
      people: documents.people.filter(d =>
        d.fileName?.toLowerCase().includes(query) ||
        d.uiName?.toLowerCase().includes(query) ||
        d.contactName?.toLowerCase().includes(query)
      ),
      tasks: documents.tasks.filter(d =>
        d.fileName?.toLowerCase().includes(query) ||
        d.uiName?.toLowerCase().includes(query) ||
        d.taskName?.toLowerCase().includes(query)
      ),
    };
  }, [documents, searchQuery]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SSoT: WAREHOUSE TYPES - Tree shows warehouse types as top level (Feb 2026)
  // warehouse_types table = SSoT for TOP LEVEL (Job, Corporate, Contact, etc.)
  // base_folders = Children of warehouse types
  // warehouse_folders = Children of base folders (tabs)
  // S3 = SSoT for file contents (loaded on expand)
  // ═══════════════════════════════════════════════════════════════════════════
  const treeData = useMemo((): TreeNode[] => {

    // Map icon names to React components
    const getIconComponent = (iconName: string | null, folderName: string): React.ReactNode => {
      // First try the icon name from the database
      if (iconName && SCOPE_ICONS[iconName]) {
        return SCOPE_ICONS[iconName];
      }
      // Fall back to folder name matching
      const normalizedName = folderName.toLowerCase().replace(/[^a-z]/g, '');
      if (normalizedName === 'jobs' || normalizedName === 'job') return SCOPE_ICONS.job;
      if (normalizedName === 'corporate') return SCOPE_ICONS.corporate;
      if (normalizedName === 'people') return SCOPE_ICONS.people;
      if (normalizedName === 'contacts' || normalizedName === 'contact') return SCOPE_ICONS.contact;
      if (normalizedName === 'emails' || normalizedName === 'email') return SCOPE_ICONS.email;
      if (normalizedName === 'attachments') return SCOPE_ICONS.attachments;
      if (normalizedName === 'tasks' || normalizedName === 'task') return SCOPE_ICONS.task;
      if (normalizedName === 'templates') return SCOPE_ICONS.templates;
      if (normalizedName === 'users' || normalizedName === 'user') return SCOPE_ICONS.users;
      if (normalizedName === 'warehousing' || normalizedName === 'warehouse') return SCOPE_ICONS.warehouse;
      if (normalizedName === 'billinbox' || normalizedName === 'bill') return SCOPE_ICONS.billinbox;
      if (normalizedName === 'chat') return SCOPE_ICONS.chat;
      return <Folder className="h-4 w-4" />;
    };

    // Build S3 file nodes for a folder path
    const buildS3FileNodes = (folderPath: string | null): TreeNode[] => {
      if (!folderPath) return [];
      const s3Data = s3Folders[folderPath];
      if (!s3Data?.files) return [];

      return s3Data.files.map(file => ({
        id: `s3-file-${(file.path || "").replace(/\//g, "-")}`,
        name: file.name,
        type: "file" as const,
        file: {
          id: file.id || file.warehouse_document_id || 0,
          source: "corporate" as const,
          fileName: file.name,
          uiName: file.name,
          mimeType: file.content_type || "",
          fileSize: file.size || 0,
          fileUrl: file.url || null,
          folderPath: file.path,
          storagePath: file.path,
          storageProvider: "s3_compatible",
          createdAt: new Date().toISOString(),
          isImage: /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name),
        },
      }));
    };

    // Convert WarehouseFolderTreeNode (tabs) to TreeNode recursively
    // sourceType is passed down from warehouse type for WarehouseDocument queries
    const convertWarehouseFolderToTreeNode = (folder: WarehouseFolderTreeNode, sourceType: string): TreeNode => {
      const folderPath = folder.fullPath || folder.folderPath;
      // Check if path contains template tokens (virtual folder)
      const isVirtual = folderPath?.includes('{{') || false;
      const s3Files = isVirtual ? [] : buildS3FileNodes(folderPath); // Don't build S3 files for virtual folders
      const children = folder.children.map(child => convertWarehouseFolderToTreeNode(child, sourceType));

      return {
        id: folder.id,
        name: folder.name,
        type: "category" as const,
        icon: getIconComponent(folder.iconName, folder.name),
        fullPath: folderPath || undefined,
        fileCount: folder.fileCount,
        sourceType,
        isVirtual,
        children: [...children, ...s3Files],
      };
    };

    // Convert BaseFolderTreeNode to TreeNode
    // sourceType is passed down from warehouse type for WarehouseDocument queries
    const convertBaseFolderToTreeNode = (baseFolder: BaseFolderTreeNode, sourceType: string): TreeNode => {
      // Use warehouse folder's folder_path if available for S3 loading
      const folderPath = baseFolder.warehouseFolder?.folderPath || baseFolder.folderPathTemplate;
      // Check if path contains template tokens (virtual folder)
      const isVirtual = folderPath?.includes('{{') || false;
      const s3Files = isVirtual ? [] : buildS3FileNodes(folderPath); // Don't build S3 files for virtual folders
      const children = baseFolder.children.map(child => convertWarehouseFolderToTreeNode(child, sourceType));

      return {
        id: baseFolder.id,
        name: baseFolder.warehouseFolder?.displayName || baseFolder.name,
        type: "category" as const,
        icon: getIconComponent(baseFolder.warehouseFolder?.iconName || null, baseFolder.name),
        fullPath: folderPath || undefined,
        pathTemplate: baseFolder.pathPreview || baseFolder.folderPathTemplate || undefined,
        fileCount: 0,
        sourceType,
        isVirtual,
        children: [...children, ...s3Files],
      };
    };

    // Convert a RecordNode to TreeNode (Feb 2026)
    // Record nodes show actual database records (jobs, contacts, etc.) with base folders as children
    const convertRecordToTreeNode = (record: RecordNode, warehouseType: WarehouseTypeTreeNode): TreeNode => {
      // Get the appropriate icon for this record type
      const recordIcon = getIconComponent(warehouseType.iconName, warehouseType.code);

      // Display name: code + name (e.g., "J-001 Smith Residence")
      const displayName = record.code ? `${record.code} ${record.name}` : record.name;

      // Helper to find child base folders of a given parent
      const findChildBaseFolders = (parentId: number | null): BaseFolderTreeNode[] => {
        return warehouseType.baseFolders.filter(bf => {
          // Extract numeric ID from "bf-123" format
          const bfParentId = bf.parentId;
          if (parentId === null) {
            return bfParentId === null;
          }
          return bfParentId === parentId;
        });
      };

      // Recursively convert base folder with its child base folders
      const convertBaseFolderWithHierarchy = (baseFolder: BaseFolderTreeNode): TreeNode => {
        const folderPath = baseFolder.warehouseFolder?.folderPath || baseFolder.folderPathTemplate;
        const isVirtual = folderPath?.includes('{{') || false;
        const s3Files = isVirtual ? [] : buildS3FileNodes(folderPath);

        // Get warehouse folder children (tabs)
        const warehouseFolderChildren = baseFolder.children.map(child =>
          convertWarehouseFolderToTreeNode(child, warehouseType.code)
        );

        // Get child base folders (hierarchical folders like PreCon > BA Approval)
        // Extract numeric ID from "bf-123" format
        const numericId = parseInt(baseFolder.id.replace('bf-', ''), 10);
        const childBaseFolders = findChildBaseFolders(numericId);
        const childBaseFolderNodes = childBaseFolders.map(child => convertBaseFolderWithHierarchy(child));

        return {
          id: baseFolder.id,
          name: baseFolder.warehouseFolder?.displayName || baseFolder.name,
          type: "category" as const,
          icon: getIconComponent(baseFolder.warehouseFolder?.iconName || null, baseFolder.name),
          fullPath: folderPath || undefined,
          pathTemplate: baseFolder.pathPreview || baseFolder.folderPathTemplate || undefined,
          fileCount: 0,
          sourceType: warehouseType.code,
          isVirtual,
          children: [...childBaseFolderNodes, ...warehouseFolderChildren, ...s3Files],
        };
      };

      // Get only root-level base folders (parentId === null) and build hierarchy from there
      const rootBaseFolders = findChildBaseFolders(null);
      const children = rootBaseFolders.map(bf => convertBaseFolderWithHierarchy(bf));

      return {
        id: `record-${warehouseType.code}-${record.id}`,
        name: displayName,
        type: "record" as const,
        icon: recordIcon,
        recordNode: record,
        warehouseTypeCode: warehouseType.code,
        sourceType: warehouseType.code,
        children,
      };
    };

    // Convert WarehouseTypeTreeNode to TreeNode (top level)
    const convertWarehouseTypeToTreeNode = (warehouseType: WarehouseTypeTreeNode): TreeNode => {
      // For warehouse types, the fullPath is the folder_path_template (e.g., "Jobs/{{JobCode}}")
      const folderPath = warehouseType.folderPathTemplate?.split('/')[0]; // Get the root folder name
      // Check if warehouse type has template tokens (virtual)
      const isVirtual = warehouseType.folderPathTemplate?.includes('{{') || false;
      const s3Files = isVirtual ? [] : (folderPath ? buildS3FileNodes(folderPath) : []);

      // Get loaded records for this warehouse type (Feb 2026)
      const recordData = warehouseRecords[warehouseType.code];
      const isLoadingRecordsForType = loadingRecords.has(warehouseType.code);

      // Build children:
      // - If records are loaded, show records as children (each record has base folders)
      // - If records are loading, show loading indicator
      // - If no records yet (not expanded), show base folders directly (existing behavior)
      let children: TreeNode[] = [];

      if (recordData?.records?.length > 0) {
        // Records loaded - show each record with its folder structure
        children = recordData.records.map(r => convertRecordToTreeNode(r, warehouseType));

        // Add "Load more" node if there are more records
        if (recordData.pagination?.has_more) {
          children.push({
            id: `load-more-${warehouseType.code}`,
            name: `Load more (${recordData.pagination.total - recordData.records.length} remaining)`,
            type: "load-more" as const,
            warehouseTypeCode: warehouseType.code,
          });
        }
      } else if (isLoadingRecordsForType) {
        // Loading records - show loading indicator
        children = [{
          id: `loading-records-${warehouseType.code}`,
          name: "Loading records...",
          type: "loading" as const,
        }];
      } else {
        // No records loaded yet - show base folders directly (existing behavior)
        // This is for when the warehouse type is collapsed or doesn't support records
        children = warehouseType.baseFolders.map(bf => convertBaseFolderToTreeNode(bf, warehouseType.code));
      }

      return {
        id: warehouseType.id,
        name: warehouseType.displayName,
        type: "category" as const,
        icon: getIconComponent(warehouseType.iconName, warehouseType.code),
        fullPath: folderPath || undefined,
        pathTemplate: warehouseType.pathPreview || warehouseType.folderPathTemplate || undefined,
        fileCount: warehouseType.fileCount,
        sourceType: warehouseType.code,
        isVirtual,
        children: [...children, ...s3Files],
      };
    };

    // Show loading state while fetching warehouse tree
    if (warehouseTreeLoading) {
      return [{
        id: "loading-tree",
        name: "Loading folders...",
        type: "loading" as const,
      }];
    }

    // Convert warehouse types tree to TreeNode format
    return warehouseTypesTree.map(convertWarehouseTypeToTreeNode);
  }, [warehouseTypesTree, warehouseTreeLoading, s3Folders, warehouseRecords, loadingRecords]);

  // Fetch files for virtual folders from WarehouseDocument table
  // Virtual folders have template tokens ({{TaskId}}, {{JobCode}}) and can't use S3 browsing
  const fetchVirtualFolderFiles = useCallback(async (sourceType: string, folderName: string, scopeKey: string) => {
    // Already loaded or loading
    if (s3Folders[scopeKey] || loadingS3Folders.has(scopeKey)) return;

    setLoadingS3Folders(prev => new Set(prev).add(scopeKey));
    try {
      // Fetch from WarehouseDocument by source_type and optional folder filter
      // Backend returns: { success, documents, folders, pagination }
      // Note: Backend uses camelCase for document fields
      const response = await api.get<{
        success: boolean;
        documents: Array<{
          id: number;
          displayName: string;  // UI name
          sendName: string;     // Download filename
          originalFilename: string;
          folder: string;
          fileSize: number;
          mimeType: string;
          source: string;       // source_type
          createdAt: string;
          fileUrl?: string;     // Pre-signed download URL
          storagePath?: string;
        }>;
        folders: Array<{ name: string; count: number }>;
        pagination: {
          total: number;
          limit: number;
          offset: number;
          has_more: boolean;
        };
      }>(`/api/v1/documents/warehouse?source_type=${encodeURIComponent(sourceType)}&folder=${encodeURIComponent(folderName)}&limit=500`);

      if (response?.success) {
        // Convert WarehouseDocument records to s3Folders format for UI compatibility
        const files = (response.documents || []).map(doc => ({
          name: doc.displayName || doc.sendName || doc.originalFilename,
          path: `${sourceType}/${doc.folder || ''}/${doc.displayName}`.replace(/\/+/g, '/'),
          size: doc.fileSize || 0,
          content_type: doc.mimeType || 'application/octet-stream',
          url: doc.fileUrl,
          id: doc.id,
          warehouse_document_id: doc.id,
        }));

        // Convert folders for drill-down
        const folders = (response.folders || []).map(f => ({
          name: f.name,
          path: `${sourceType}/${folderName}/${f.name}`.replace(/\/+/g, '/'),
          count: f.count,
        }));

        setS3Folders(prev => ({
          ...prev,
          [scopeKey]: { folders, files },
        }));
      }
    } catch (err) {
      console.error(`Failed to fetch virtual folder files for ${sourceType}/${folderName}:`, err);
      // Set empty to prevent re-fetching
      setS3Folders(prev => ({
        ...prev,
        [scopeKey]: { folders: [], files: [] },
      }));
    } finally {
      setLoadingS3Folders(prev => {
        const next = new Set(prev);
        next.delete(scopeKey);
        return next;
      });
    }
  }, [s3Folders, loadingS3Folders]);

  // Toggle folder expansion and fetch folder contents
  // SSoT: Virtual folders load from WarehouseDocument, physical folders from S3
  const toggleFolder = useCallback((
    folderId: string,
    folderPath?: string,
    externalLink?: string,
    sourceType?: string,
    isVirtual?: boolean
  ) => {
    // If folder has external link (e.g., Emails → /email), navigate instead of expanding
    if (externalLink) {
      router.push(externalLink);
      return;
    }

    // Check if already expanded (will collapse) or needs to expand
    const wasExpanded = expandedFolders.has(folderId);

    // Update expansion state
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });

    // If expanding (not collapsing), fetch folder contents
    if (!wasExpanded) {
      // Check if this is a warehouse type node (e.g., "wt-job", "wt-corporate")
      // These nodes should fetch records when expanded
      if (folderId.startsWith("wt-")) {
        const warehouseTypeCode = folderId.replace("wt-", "");
        // Fetch records for this warehouse type (unless email which doesn't have record folders)
        if (warehouseTypeCode !== "email") {
          fetchRecords(warehouseTypeCode);
        }
      } else if (isVirtual && sourceType) {
        // Virtual folder - fetch from WarehouseDocument
        // Use folderId as scope key for caching
        const folderName = folderPath || '';
        fetchVirtualFolderFiles(sourceType, folderName, folderId);
      } else if (folderPath) {
        // Physical folder - fetch from S3
        fetchS3Folders(folderPath);
      }
    }
  }, [expandedFolders, fetchS3Folders, fetchVirtualFolderFiles, fetchRecords, router]);

  // Open file in new window (for double-click)
  const openFileInNewWindow = useCallback((doc: DocumentItem) => {
    // Cancel any pending single-click action
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    if (doc.fileUrl) {
      window.open(doc.fileUrl, "_blank");
    }
  }, []);

  // Open file in popup (for single-click)
  // Uses a delay to allow double-click to cancel
  const openFileInPopup = useCallback((doc: DocumentItem) => {
    // Cancel any existing timer
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }
    // Set a new timer - if double-click happens, this will be cancelled
    clickTimerRef.current = setTimeout(() => {
      setPreviewDocument(doc);
      clickTimerRef.current = null;
    }, 200); // 200ms delay to detect double-click
  }, []);

  // Open mailbox drawer (for single-click on mailbox folder)
  // Uses a delay to allow double-click to cancel and navigate instead
  const handleMailboxClick = useCallback((mailboxEmail: string) => {
    // Cancel any existing timer
    if (mailboxClickTimerRef.current) {
      clearTimeout(mailboxClickTimerRef.current);
    }
    // Set a new timer - if double-click happens, this will be cancelled
    mailboxClickTimerRef.current = setTimeout(() => {
      setSelectedMailbox(mailboxEmail);
      setMailboxDrawerOpen(true);
      mailboxClickTimerRef.current = null;
    }, 200); // 200ms delay to detect double-click
  }, []);

  // Open mailbox in new window (for double-click on mailbox folder)
  const handleMailboxDoubleClick = useCallback((externalLink: string) => {
    // Cancel any pending single-click action
    if (mailboxClickTimerRef.current) {
      clearTimeout(mailboxClickTimerRef.current);
      mailboxClickTimerRef.current = null;
    }
    window.open(externalLink, "_blank");
  }, []);

  // Start rename mode
  const handleStartRename = useCallback(() => {
    if (!previewDocument) return;
    setRenameValue(previewDocument.uiName || previewDocument.fileName);
    setIsRenaming(true);
  }, [previewDocument]);

  // Cancel rename
  const handleCancelRename = useCallback(() => {
    setIsRenaming(false);
    setRenameValue("");
  }, []);

  // Save rename
  const handleSaveRename = useCallback(async () => {
    if (!previewDocument || !renameValue.trim()) return;

    const newName = renameValue.trim();
    // Don't save if name didn't change
    if (newName === previewDocument.uiName || newName === previewDocument.fileName) {
      setIsRenaming(false);
      return;
    }

    setIsRenameSaving(true);
    try {
      // SSoT: Use storagePath (full S3 key) if available
      // This avoids the bug where folderPath + fileName reconstruction fails
      // when a folder name matches the filename (e.g., "ASIC Teeem Registration/ASIC Teeem Registration")
      let path = previewDocument.storagePath || "";

      // Fallback: reconstruct from folderPath + fileName if storagePath not available
      if (!path && previewDocument.folderPath) {
        path = previewDocument.folderPath;
        const currentFilename = previewDocument.fileName;
        // Only append filename if path is clearly a folder (ends with /)
        // Don't use endsWith(filename) check - it fails when folder name = filename
        if (currentFilename && path.endsWith("/")) {
          path = `${path}${currentFilename}`;
        } else if (currentFilename && !path.includes(currentFilename)) {
          // Only append if filename is not anywhere in the path
          path = `${path}/${currentFilename}`;
        }
      }

      // Remove leading slash for S3 key
      path = path.replace(/^\//, "");

      const response = await api.post<{
        success: boolean;
        new_name: string;
        new_path: string;
        error?: string;
      }>("/api/v1/documents/rename", {
        path: path,
        new_name: newName,
        document_id: previewDocument.id,
        source: previewDocument.source,
      });

      if (response?.success) {
        // Update the preview document with new name and path
        // storagePath is the SSoT for S3 key - must be updated for subsequent renames
        setPreviewDocument({
          ...previewDocument,
          fileName: response.new_name,
          uiName: response.new_name,
          storagePath: response.new_path,  // SSoT: full S3 key
          folderPath: response.new_path,   // Keep for backward compatibility
        });
        // Clear folder files cache so renamed file shows with new name when re-expanding
        setFolderFiles({});
        setIsRenaming(false);
      } else {
        toast({ title: "Error", description: response?.error || "Failed to rename file", variant: "destructive" });
      }
    } catch (err) {
      console.error("Rename failed:", err);
      toast({ title: "Error", description: "Failed to rename file", variant: "destructive" });
    } finally {
      setIsRenameSaving(false);
    }
  }, [previewDocument, renameValue]);

  // Check if document is orphaned (task source but no linked task)
  const isOrphanedDocument = useCallback((doc: DocumentItem | null): boolean => {
    if (!doc) return false;
    return doc.source === "task" && !doc.taskId;
  }, []);

  // Search for tasks to link to
  const searchTasksForLink = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setLinkToTaskResults([]);
      return;
    }
    try {
      const response = await api.get<{ tasks: Array<{ id: number; name: string; task_number: number }>; success: boolean }>(
        `/api/v1/sm_tasks?search=${encodeURIComponent(searchTerm)}&limit=10`
      );
      if (response.success && response.tasks) {
        setLinkToTaskResults(response.tasks.map(t => ({ id: t.id, name: t.name, task_number: t.task_number })));
      }
    } catch (error) {
      console.error("Failed to search tasks:", error);
    }
  }, []);

  // Step 1: Select task and load its questions
  const handleSelectTaskForLink = useCallback(async (task: { id: number; name: string; task_number: number }) => {
    setIsLoadingTaskQuestions(true);
    try {
      const response = await api.get<{
        success: boolean;
        sm_task: {
          id: number;
          name: string;
          task_number: number;
          action_items: Array<{
            id: number;
            text: string;
            item_type: string;
            attachments: Array<{ attachable_id: number }>;
          }>;
        };
      }>(`/api/v1/sm_tasks/${task.id}`);

      if (response.success && response.sm_task) {
        setSelectedTaskForLink({
          id: response.sm_task.id,
          name: response.sm_task.name,
          task_number: response.sm_task.task_number,
          action_items: response.sm_task.action_items || [],
        });
        // Clear search results since we're moving to step 2
        setLinkToTaskSearch("");
        setLinkToTaskResults([]);
      }
    } catch (error) {
      console.error("Failed to load task questions:", error);
      toast({
        title: "Error",
        description: "Failed to load task questions",
        variant: "destructive",
      });
    } finally {
      setIsLoadingTaskQuestions(false);
    }
  }, [toast]);

  // Check if document is already attached to this task/question
  const isAlreadyAttachedTo = useCallback((actionItemId: number | null): boolean => {
    if (!previewDocument || !selectedTaskForLink) return false;

    if (actionItemId === null) {
      // Check general attachments - look for any attachment without action_item
      // Since we don't have full attachment data here, we'll let the backend handle this
      return false;
    }

    // Check if this document is already attached to this specific question
    const actionItem = selectedTaskForLink.action_items.find(ai => ai.id === actionItemId);
    if (!actionItem) return false;

    return actionItem.attachments.some(att => att.attachable_id === previewDocument.id);
  }, [previewDocument, selectedTaskForLink]);

  // Step 2: Link document to selected task/question
  const handleLinkToTask = useCallback(async (actionItemId: number | null) => {
    if (!previewDocument || !selectedTaskForLink) return;

    // Client-side duplicate check for questions
    if (actionItemId !== null && isAlreadyAttachedTo(actionItemId)) {
      toast({
        title: "Already attached",
        description: "This document is already attached to this question",
        variant: "destructive",
      });
      return;
    }

    setIsLinkingToTask(true);
    try {
      const response = await api.patch<{
        success: boolean;
        document: DocumentItem;
        task: { id: number; name: string; task_number: number };
        error?: string;
      }>(
        `/api/v1/documents/${previewDocument.id}/link_to_task`,
        {
          task_id: selectedTaskForLink.id,
          action_item_id: actionItemId,
          category: actionItemId ? "response" : "info",
        }
      );

      if (response.success) {
        const locationName = actionItemId
          ? selectedTaskForLink.action_items.find(ai => ai.id === actionItemId)?.text?.substring(0, 50) || "question"
          : "Attachments";
        toast({
          title: "Document linked",
          description: `Linked to Task #${response.task.task_number} → ${locationName}`,
        });
        // Update the preview document with new task info
        setPreviewDocument({
          ...previewDocument,
          taskId: response.task.id,
          taskName: response.task.name,
          taskNumber: response.task.task_number,
        });
        // Reset dialog state
        setShowLinkToTaskDialog(false);
        setLinkToTaskSearch("");
        setLinkToTaskResults([]);
        setSelectedTaskForLink(null);
        // Refresh the file list to update folder structure
        fetchDocuments();
      } else {
        toast({
          title: "Failed to link",
          description: response.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to link document to task",
        variant: "destructive",
      });
    } finally {
      setIsLinkingToTask(false);
    }
  }, [previewDocument, selectedTaskForLink, toast, fetchDocuments, isAlreadyAttachedTo]);

  // Render tree node recursively
  const renderTreeNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(node.id);
    const paddingLeft = depth * 20;

    // Loading state - folder index is being built
    if (node.type === "loading") {
      const progress = node.progress;
      return (
        <div key={node.id} className="p-6 text-center">
          <div className="animate-pulse mb-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          </div>
          <p className="text-sm font-medium mb-2">{node.name}</p>
          {progress && (
            <div className="space-y-2 max-w-xs mx-auto">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {progress.processed.toLocaleString()} / {progress.total.toLocaleString()} documents ({progress.percent}%)
                {progress.remaining_seconds && progress.remaining_seconds > 0 && (
                  <> &middot; ~{Math.ceil(progress.remaining_seconds / 60)} min remaining</>
                )}
              </p>
            </div>
          )}
        </div>
      );
    }

    // Load more button - for paginated records (Feb 2026)
    if (node.type === "load-more") {
      const warehouseTypeCode = node.warehouseTypeCode;
      const isLoadingMore = warehouseTypeCode ? loadingRecords.has(warehouseTypeCode) : false;
      const recordData = warehouseTypeCode ? warehouseRecords[warehouseTypeCode] : null;
      const currentOffset = recordData?.records?.length || 0;

      return (
        <div
          key={node.id}
          className="flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-md cursor-pointer text-primary"
          style={{ paddingLeft: `${paddingLeft + 12}px` }}
          onClick={() => {
            if (warehouseTypeCode && !isLoadingMore) {
              fetchRecords(warehouseTypeCode, currentOffset);
            }
          }}
        >
          {isLoadingMore ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="text-sm">{node.name}</span>
        </div>
      );
    }

    // Record node - shows actual database record (job, contact, etc.) (Feb 2026)
    if (node.type === "record") {
      const hasChildren = node.children && node.children.length > 0;

      return (
        <div key={node.id}>
          <div
            className={cn(
              "flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-md cursor-pointer",
              isExpanded && "bg-muted/30"
            )}
            style={{ paddingLeft: `${paddingLeft}px` }}
            onClick={() => toggleFolder(node.id, node.fullPath, node.externalLink, node.sourceType, node.isVirtual)}
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform shrink-0",
                isExpanded && "rotate-90",
                !hasChildren && "invisible"
              )}
            />
            {node.icon || <Folder className="h-4 w-4" />}
            <span className="flex-1 truncate font-medium">{node.name}</span>
            {node.recordNode?.subtitle && (
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                {node.recordNode.subtitle}
              </span>
            )}
          </div>
          {/* Render children when expanded */}
          {isExpanded && hasChildren && (
            <div>
              {node.children?.map(child => renderTreeNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    if (node.type === "file") {
      const file = node.file!;

      // Gallery mode for images within tree
      if (treeDisplayMode === "gallery" && file.isImage) {
        const isGallerySelected = previewDocument?.id === file.id && previewDocument?.source === file.source;
        return (
          <div
            key={node.id}
            className={cn(
              "relative group cursor-pointer",
              isGallerySelected && "ring-2 ring-primary rounded-lg"
            )}
            onClick={() => openFileInPopup(file)}
            onDoubleClick={() => openFileInNewWindow(file)}
          >
            <div className="aspect-square bg-muted rounded-lg overflow-hidden border hover:border-primary transition-colors">
              {file.fileUrl ? (
                <img
                  src={file.fileUrl}
                  alt={file.uiName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>
            <p className="mt-1 text-xs truncate text-center">{file.uiName}</p>
          </div>
        );
      }

      // List mode file
      const isSelected = previewDocument?.id === file.id && previewDocument?.source === file.source;
      return (
        <div
          key={node.id}
          className={cn(
            "flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-md group cursor-pointer",
            isSelected && "bg-primary/10 hover:bg-primary/15"
          )}
          style={{ paddingLeft: `${paddingLeft + 12}px` }}
          onClick={() => openFileInPopup(file)}
          onDoubleClick={() => openFileInNewWindow(file)}
        >
          {file.isImage ? (
            <ImageIcon className="h-4 w-4 text-blue-500 dark:text-blue-400" />
          ) : (
            <File className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="flex-1 truncate">{node.name}</span>
          {file.storageProvider === "s3_compatible" && (
            <Badge variant="outline" className="text-xs">S3</Badge>
          )}
          {file.fileSize > 0 && (
            <span className="text-xs text-muted-foreground">
              {formatFileSize(file.fileSize)}
            </span>
          )}
          <div className="opacity-0 group-hover:opacity-100">
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
      );
    }

    // Folder/category/parent node
    const fileCount = node.fileCount || 0;
    const hasChildren = node.children && node.children.length > 0;

    // Get images for gallery mode
    const getImagesFromNode = (n: TreeNode): DocumentItem[] => {
      if (n.type === "file" && n.file?.isImage) return [n.file];
      if (!n.children) return [];
      return n.children.flatMap(getImagesFromNode);
    };

    const images = treeDisplayMode === "gallery" ? getImagesFromNode(node) : [];

    // Get folder path for S3 lookup - extract from fullPath or use scopeFolders
    const getFolderPath = (): string | undefined => {
      // For S3-driven scope folders (job, corporate, contact, etc.),
      // use the scope folder name directly (e.g., "Jobs"), NOT the fullPath with template tokens
      const S3_SCOPE_IDS = ["job", "corporate", "contact", "contacts"];
      if (S3_SCOPE_IDS.includes(node.id)) {
        // Use scopeFolders mapping which gives us just the folder name (e.g., "Jobs")
        const scopePath = scopeFolders[node.id];
        return scopePath || node.name;
      }

      // Helper to strip root path prefix from a path
      // SSoT: rootPath comes from WarehouseProvider (e.g., "/" for S3, "/Shared Documents" for SharePoint)
      const stripRootPath = (path: string): string => {
        if (!path) return path;
        const normalizedPath = path.replace(/^\/+/, '');  // Remove leading slashes
        const normalizedRoot = rootPath.replace(/^\/+/, '').replace(/\/+$/, '');  // Normalize root

        if (normalizedRoot && normalizedPath.startsWith(normalizedRoot + '/')) {
          return normalizedPath.slice(normalizedRoot.length + 1);
        }
        if (normalizedRoot && normalizedPath.startsWith(normalizedRoot)) {
          return normalizedPath.slice(normalizedRoot.length).replace(/^\/+/, '');
        }
        return normalizedPath;
      };

      // For S3 subfolder nodes (created from fetchS3Folders results)
      if (node.id.startsWith("s3-folder-")) {
        if (node.fullPath) {
          // Strip root path prefix (provider-agnostic)
          return stripRootPath(node.fullPath);
        }
      }

      if (node.fullPath) {
        // Skip paths with template tokens like {{JobCode}}
        if (node.fullPath.includes('{{')) {
          return node.name;
        }
        // Strip root path prefix (provider-agnostic)
        return stripRootPath(node.fullPath);
      }
      // Fallback: use scopeFolders mapping
      return scopeFolders[node.id] || undefined;
    };

    const folderPath = getFolderPath();
    // For virtual folders, use node.id as the cache key (since path has templates)
    const cacheKey = node.isVirtual ? node.id : folderPath;
    // Check both folder loading and S3 folder loading states
    const isLoading = loadingFolders.has(node.id) || (cacheKey ? loadingS3Folders.has(cacheKey) : false);
    const loadedFiles = folderFiles[node.id] || [];
    const hasLoadedFiles = loadedFiles.length > 0;
    // Check if S3 folder data is loaded for this path (or node.id for virtual folders)
    const s3Data = cacheKey ? s3Folders[cacheKey] : null;
    const hasS3Data = s3Data && (s3Data.folders.length > 0 || s3Data.files.length > 0);
    // FRC (Jan 2026): Also check if folder was LOADED (even if empty)
    // This ensures "No files in this folder" renders for empty folders
    const s3DataLoaded = cacheKey ? s3Folders[cacheKey] !== undefined : false;

    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center gap-2 py-2 px-3 hover:bg-muted/50 cursor-pointer rounded-md",
            node.type === "category" && "font-semibold"
          )}
          style={{ paddingLeft: `${paddingLeft + 12}px` }}
          onClick={() => {
            // Mailbox folders: single-click opens drawer
            if (node.isMailbox && node.mailboxEmail) {
              handleMailboxClick(node.mailboxEmail);
            } else {
              toggleFolder(node.id, folderPath, node.externalLink, node.sourceType, node.isVirtual);
            }
          }}
          onDoubleClick={() => {
            // Mailbox folders: double-click opens external link in new window
            if (node.isMailbox && node.externalLink) {
              handleMailboxDoubleClick(node.externalLink);
            }
          }}
          title={node.fullPath || undefined}
        >
          {/* Show chevron if expandable (has children OR files OR is S3-driven folder OR is virtual folder)
              BUT NOT for mailbox folders (they open drawer) or external link folders (they navigate away) */}
          {!node.externalLink && !node.isMailbox && (hasChildren || fileCount > 0 || node.isVirtual || node.id.startsWith("s3-folder-") || ["job", "corporate", "contact", "contacts"].includes(node.id)) ? (
            isLoading ? (
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
            ) : (
              <ChevronRight
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                  isExpanded && "rotate-90"
                )}
              />
            )
          ) : (
            <div className="w-4 shrink-0" /> // Spacer for alignment
          )}
          {node.type === "category" && node.icon}
          {node.type !== "category" && (
            <Folder className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
          )}
          <div className="flex-1 min-w-0">
            <span>{node.name}</span>
            {/* Show folder path template for scope folders */}
            {node.type === "category" && node.pathTemplate && (
              <span className="ml-2 text-xs font-normal text-muted-foreground font-mono truncate">
                {node.pathTemplate}
              </span>
            )}
          </div>
          {/* Show count - for S3 folders show folder+file count once loaded */}
          {(fileCount > 0 || hasS3Data || node.mailboxCount) && (
            <Badge variant="secondary" className="text-xs">
              {hasS3Data
                ? `${s3Data!.folders.length + s3Data!.files.length} items`
                : node.mailboxCount
                  ? `${fileCount.toLocaleString()} emails • ${node.mailboxCount} ${node.mailboxCount === 1 ? "mailbox" : "mailboxes"}`
                  : `${fileCount} ${fileCount === 1 ? "file" : "files"}`
              }
            </Badge>
          )}
          {/* Mailbox folder indicator - shows mail icon for drawer, external for double-click */}
          {node.isMailbox && (
            <div className="flex items-center gap-1" title="Click to open drawer, double-click to open in new window">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <ExternalLink className="h-3 w-3 text-muted-foreground/50" />
            </div>
          )}
          {/* External link indicator for non-mailbox folders that navigate away */}
          {node.externalLink && !node.isMailbox && (
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {isExpanded && (hasChildren || hasLoadedFiles || hasS3Data || s3DataLoaded || isLoading) && (
          <div className={cn(depth > 0 && "border-l border-muted ml-6")}>
            {isLoading ? (
              // Loading state
              <div className="py-2 px-3" style={{ paddingLeft: `${paddingLeft + 32}px` }}>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading files...
                </div>
              </div>
            ) : treeDisplayMode === "gallery" && images.length > 0 ? (
              // Gallery view within folder
              <div className="p-4" style={{ paddingLeft: `${paddingLeft + 32}px` }}>
                <div className="grid grid-cols-6 gap-2 mb-4">
                  {images.slice(0, 12).map(img => {
                    const isImgSelected = previewDocument?.id === img.id && previewDocument?.source === img.source;
                    return (
                    <div
                      key={img.id}
                      className={cn(
                        "relative group cursor-pointer",
                        isImgSelected && "ring-2 ring-primary rounded-lg"
                      )}
                      onClick={() => openFileInPopup(img)}
                      onDoubleClick={() => openFileInNewWindow(img)}
                    >
                      <div className="aspect-square bg-muted rounded-lg overflow-hidden border hover:border-primary">
                        {img.fileUrl ? (
                          <img
                            src={img.fileUrl}
                            alt={img.uiName}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </div>
                  );})}
                  {images.length > 12 && (
                    <div className="aspect-square bg-muted rounded-lg flex items-center justify-center text-sm text-muted-foreground">
                      +{images.length - 12} more
                    </div>
                  )}
                </div>
                {/* Render non-image files in list mode */}
                {node.children
                  ?.filter(c => c.type === "file" && !c.file?.isImage)
                  .map(child => renderTreeNode(child, depth + 1))}
                {/* Render subfolders */}
                {node.children
                  ?.filter(c => c.type !== "file")
                  .map(child => renderTreeNode(child, depth + 1))}
              </div>
            ) : (
              <>
                {/* Standard list view - render children first */}
                {node.children?.map(child => renderTreeNode(child, depth + 1))}
                {/* Then render dynamically loaded files from S3 */}
                {hasLoadedFiles && loadedFiles.map((file) => {
                  const fileNode: TreeNode = {
                    id: `loaded-${node.id}-${file.fileName}`,
                    name: file.uiName || file.fileName,
                    type: "file",
                    file,
                  };
                  return renderTreeNode(fileNode, depth + 1);
                })}
                {/* Show empty state if no children, no loaded files, and no S3 data */}
                {!hasChildren && !hasLoadedFiles && !hasS3Data && !isLoading && (
                  <div
                    className="py-2 px-3 text-sm text-muted-foreground"
                    style={{ paddingLeft: `${paddingLeft + 32}px` }}
                  >
                    No files in this folder
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  // All documents flat list
  const allDocumentsFlat = useMemo(() => {
    return [
      ...filteredDocuments.jobs,
      ...filteredDocuments.corporate,
      ...filteredDocuments.people,
      ...filteredDocuments.tasks,
    ];
  }, [filteredDocuments]);

  // All images for gallery view
  const allImages = useMemo(() => {
    return allDocumentsFlat.filter(d => d.isImage);
  }, [allDocumentsFlat]);

  return (
    <div
      className="flex flex-col h-full -mx-4 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag-and-drop overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center" data-tour="warehouse-upload">
          <div className="text-center">
            <Download className="h-12 w-12 text-primary mx-auto mb-2" />
            <p className="text-lg font-medium text-primary">Drop files to upload</p>
            <p className="text-sm text-muted-foreground">Files will be saved to My Documents</p>
          </div>
        </div>
      )}

      {/* Upload progress toast */}
      {uploadProgress && (
        <div className="absolute top-4 right-4 z-50 bg-background border rounded-lg shadow-lg p-4 flex items-center gap-3">
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <Check className="h-5 w-5 text-green-500 dark:text-green-400" />
          )}
          <span className="text-sm">{uploadProgress}</span>
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-4 border-b shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <BackButton fallbackHref="/dashboard" />
            <div>
              <h1 className="text-2xl font-bold">File Warehouse</h1>
              <p className="text-sm text-muted-foreground">
                {counts.total.toLocaleString()} files across all storage locations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative w-64" data-tour="warehouse-search">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === "tree" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-r-none"
                onClick={() => setViewMode("tree")}
              >
                <FolderTree className="h-4 w-4 mr-1" />
                Tree
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-none border-x"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4 mr-1" />
                List
              </Button>
              <Button
                variant={viewMode === "gallery" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-l-none"
                onClick={() => setViewMode("gallery")}
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                Gallery
              </Button>
            </div>

            {/* Tree Sub-Toggle (only in tree mode) */}
            {viewMode === "tree" && (
              <Select
                value={treeDisplayMode}
                onValueChange={(v) => setTreeDisplayMode(v as TreeDisplayMode)}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="list">
                    <div className="flex items-center gap-2">
                      <List className="h-3 w-3" />
                      List
                    </div>
                  </SelectItem>
                  <SelectItem value="gallery">
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="h-3 w-3" />
                      Gallery
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Desktop Sync Settings */}
            <Button variant="outline" size="sm" onClick={handleOpenSyncSettings}>
              <Cloud className="h-4 w-4 mr-1" />
              Sync Settings
            </Button>

            {/* Refresh */}
            <Button variant="outline" size="icon" onClick={fetchDocuments} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      {/* Background Job Progress Banner */}
      {activeJob && (
        <div className="px-4 py-3 bg-blue-50 dark:bg-blue-950/30 border-b shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-medium text-sm">
                {activeJob.metadata?.dry_run ? "Previewing" : "Reorganizing"} {activeJob.scope || "files"}...
              </span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                {/* Progress bar */}
                <div className="flex-1 h-2 bg-blue-100 dark:bg-blue-900/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 dark:bg-blue-400 transition-all duration-300"
                    style={{ width: `${activeJob.progress_percent}%` }}
                  />
                </div>
                {/* Progress text */}
                <span className="text-sm text-blue-600 dark:text-blue-400 tabular-nums min-w-[4rem]">
                  {activeJob.progress_percent}%
                </span>
              </div>
              {/* Details row */}
              <div className="flex items-center gap-4 mt-1 text-xs text-blue-500 dark:text-blue-400/80">
                <span>
                  {activeJob.processed_items.toLocaleString()} / {activeJob.total_items.toLocaleString()} files
                </span>
                {activeJob.elapsed_time && (
                  <span>Elapsed: {activeJob.elapsed_time}</span>
                )}
                {activeJob.estimated_remaining && activeJob.estimated_remaining > 0 && (
                  <span>~{Math.ceil(activeJob.estimated_remaining / 60)}m remaining</span>
                )}
                {activeJob.current_item && (
                  <span className="truncate max-w-[300px]" title={activeJob.current_item}>
                    {activeJob.current_item}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content - Split Pane Layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left Panel - File Browser */}
        <div className={cn(
          "flex-1 overflow-auto px-4 py-4 border-r",
          previewDocument && "max-w-[50%]"
        )} data-tour="warehouse-files">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-muted animate-pulse" />
                <Loader2 className="h-16 w-16 absolute inset-0 animate-spin text-primary" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-medium">Loading File Warehouse</p>
                <p className="text-sm text-muted-foreground">
                  Fetching {counts.total > 0 ? `${counts.total.toLocaleString()} documents` : 'documents'}...
                </p>
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          ) : viewMode === "tree" ? (
            // Tree View
            <div className="space-y-1" data-tour="warehouse-folders">
              {treeData.map(node => renderTreeNode(node, 0))}
            </div>
          ) : viewMode === "list" ? (
            // Flat List View
            <div className="space-y-1">
              {allDocumentsFlat.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No documents found
                </div>
              ) : (
                allDocumentsFlat.map(doc => (
                  <div
                    key={`${doc.source}-${doc.id}`}
                    className={cn(
                      "flex items-center gap-3 py-2 px-3 hover:bg-muted/50 rounded-md cursor-pointer group",
                      previewDocument?.id === doc.id && previewDocument?.source === doc.source && "bg-primary/10 hover:bg-primary/15"
                    )}
                    onClick={() => openFileInPopup(doc)}
                    onDoubleClick={() => openFileInNewWindow(doc)}
                  >
                    {doc.isImage ? (
                      <ImageIcon className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0" />
                    ) : (
                      <File className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="flex-1 truncate">{doc.uiName || doc.fileName}</span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {doc.source === "job" && doc.jobNumber && `Job ${doc.jobNumber}`}
                      {doc.source === "corporate" && doc.companyName}
                      {doc.source === "people" && doc.contactName}
                      {doc.source === "task" && doc.taskName}
                    </Badge>
                    {doc.storageProvider === "s3_compatible" && (
                      <Badge variant="secondary" className="text-xs shrink-0">S3</Badge>
                    )}
                    {doc.fileSize > 0 && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatFileSize(doc.fileSize)}
                      </span>
                    )}
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                  </div>
                ))
              )}
            </div>
          ) : (
            // Gallery View (images only)
            <div>
              {allImages.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No images found
                </div>
              ) : (
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {allImages.map(doc => (
                    <div
                      key={`gallery-${doc.source}-${doc.id}`}
                      className={cn(
                        "group cursor-pointer",
                        previewDocument?.id === doc.id && previewDocument?.source === doc.source && "ring-2 ring-primary rounded-lg"
                      )}
                      onClick={() => openFileInPopup(doc)}
                      onDoubleClick={() => openFileInNewWindow(doc)}
                    >
                      <div className="aspect-square bg-muted rounded-lg overflow-hidden border hover:border-primary transition-colors">
                        {doc.fileUrl ? (
                          <img
                            src={doc.fileUrl}
                            alt={doc.uiName}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <p className="mt-1 text-xs truncate text-center">{doc.uiName}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Preview Panel */}
        {previewDocument && (
          <div className="w-1/2 flex flex-col min-h-0 bg-muted/30 dark:bg-background/50">
            {/* Preview Header */}
            <div className="px-4 py-3 border-b bg-background shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {isRenaming ? (
                    // Rename input mode
                    <div className="flex items-center gap-2">
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveRename();
                          if (e.key === "Escape") handleCancelRename();
                        }}
                        className="h-8 text-sm"
                        autoFocus
                        disabled={isRenameSaving}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={handleSaveRename}
                        disabled={isRenameSaving}
                        title="Save"
                      >
                        {isRenameSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={handleCancelRename}
                        disabled={isRenameSaving}
                        title="Cancel"
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ) : (
                    // Normal display mode
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium truncate">
                        {previewDocument.uiName || previewDocument.fileName}
                      </h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={handleStartRename}
                        title="Rename file"
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {previewDocument.source === "job" && previewDocument.jobNumber && (
                      <Badge variant="outline" className="text-xs">Job {previewDocument.jobNumber}</Badge>
                    )}
                    {previewDocument.source === "corporate" && previewDocument.companyName && (
                      <Badge variant="outline" className="text-xs">{previewDocument.companyName}</Badge>
                    )}
                    {previewDocument.source === "people" && previewDocument.contactName && (
                      <Badge variant="outline" className="text-xs">{previewDocument.contactName}</Badge>
                    )}
                    {previewDocument.source === "task" && previewDocument.taskName && (
                      <Badge variant="outline" className="text-xs">{previewDocument.taskName}</Badge>
                    )}
                    {/* Orphaned task document - show warning and link option */}
                    {isOrphanedDocument(previewDocument) && (
                      <>
                        <Badge variant="destructive" className="text-xs gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Orphaned
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-5 text-xs px-2 gap-1"
                          onClick={() => setShowLinkToTaskDialog(true)}
                        >
                          <Link2 className="h-3 w-3" />
                          Link to Task
                        </Button>
                      </>
                    )}
                    {previewDocument.storageProvider === "s3_compatible" && (
                      <Badge variant="secondary" className="text-xs">S3</Badge>
                    )}
                    {previewDocument.fileSize > 0 && (
                      <span>{formatFileSize(previewDocument.fileSize)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {previewDocument.fileUrl && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => window.open(previewDocument.fileUrl!, "_blank")}
                        title="Open in new tab"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                      <DocumentActions
                        document={{
                          id: previewDocument.id,
                          fileName: previewDocument.fileName,
                          uiName: previewDocument.uiName,
                          fileUrl: previewDocument.fileUrl,
                          storagePath: previewDocument.storagePath,
                          mimeType: previewDocument.mimeType,
                          source: previewDocument.source,
                        }}
                        variant="inline"
                        size="icon"
                      />
                    </>
                  )}
                  {/* Link to Task button - available for ALL documents */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowLinkToTaskDialog(true)}
                    title="Link to Task"
                  >
                    <Link2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setPreviewDocument(null);
                      setIsRenaming(false);
                    }}
                    title="Close preview"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 min-h-0 overflow-auto">
              {previewDocument.fileUrl ? (
                previewDocument.isImage ? (
                  // Image preview
                  <div className="h-full w-full flex items-center justify-center p-4">
                    <img
                      src={previewDocument.fileUrl}
                      alt={previewDocument.uiName}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : previewDocument.mimeType?.includes("pdf") ||
                  previewDocument.fileName?.toLowerCase().endsWith(".pdf") ||
                  previewDocument.uiName?.toLowerCase().endsWith(".pdf") ? (
                  // PDF preview (check mime type OR file extension)
                  <PDFViewer url={previewDocument.fileUrl} className="h-full" />
                ) : previewDocument.mimeType?.includes("wordprocessingml") ||
                  previewDocument.fileName?.toLowerCase().endsWith(".docx") ||
                  previewDocument.uiName?.toLowerCase().endsWith(".docx") ? (
                  // Word document preview using TeeemWord's mammoth conversion
                  <WordDocumentPreview url={previewDocument.fileUrl} className="h-full" />
                ) : previewDocument.mimeType?.includes("spreadsheetml") ||
                  previewDocument.mimeType?.includes("ms-excel") ||
                  previewDocument.fileName?.toLowerCase().endsWith(".xlsx") ||
                  previewDocument.fileName?.toLowerCase().endsWith(".xls") ||
                  previewDocument.uiName?.toLowerCase().endsWith(".xlsx") ||
                  previewDocument.uiName?.toLowerCase().endsWith(".xls") ? (
                  // Excel document preview using TeeemXL
                  <ExcelDocumentPreview url={previewDocument.fileUrl} className="h-full" />
                ) : (
                  // Other file types - show preview placeholder
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                    <File className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium mb-2">{previewDocument.uiName || previewDocument.fileName}</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Preview not available for this file type
                    </p>
                    <Button onClick={() => window.open(previewDocument.fileUrl!, "_blank")}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open File
                    </Button>
                  </div>
                )
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <File className="h-16 w-16 mb-4 opacity-50" />
                  <p>No file available</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Desktop Sync Settings Modal */}
      <Dialog open={showSyncSettings} onOpenChange={setShowSyncSettings}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              Desktop Sync Settings
            </DialogTitle>
          </DialogHeader>

          {syncLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs defaultValue="file-types" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="file-types">File Types</TabsTrigger>
                <TabsTrigger value="folders">Synced Folders</TabsTrigger>
                <TabsTrigger value="devices">Devices</TabsTrigger>
              </TabsList>

              {/* File Types Tab */}
              <TabsContent value="file-types" className="space-y-4 mt-4">
                <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Cloud className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900 dark:text-blue-100">Opt-in Sync</p>
                    <p className="text-blue-700 dark:text-blue-300">
                      Nothing syncs by default. Enable the file types you want to sync to your desktop.
                    </p>
                  </div>
                </div>

                {/* File Type Categories */}
                {syncCategories.length > 0 ? (
                  <div className="space-y-2">
                    {syncCategories.map((category) => (
                      <div
                        key={category.key}
                        className={cn(
                          "flex items-center justify-between py-3 px-4 rounded-lg border transition-colors",
                          category.enabled
                            ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                            : "bg-muted/50 border-transparent"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center",
                            category.enabled
                              ? "bg-green-100 dark:bg-green-900"
                              : "bg-muted"
                          )}>
                            <File className={cn(
                              "h-4 w-4",
                              category.enabled
                                ? "text-green-600 dark:text-green-400"
                                : "text-muted-foreground"
                            )} />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{category.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {category.description}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {category.extensions.slice(0, 5).join(", ")}
                              {category.extensions.length > 5 && ` +${category.extensions.length - 5} more`}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={category.enabled}
                          onCheckedChange={(checked) => handleToggleCategory(category.key, checked)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CloudOff className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Download TEEEM Sync to configure file types.</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={handleDownloadDesktopApp}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download TEEEM Sync
                    </Button>
                  </div>
                )}

                {/* Always excluded info */}
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <h3 className="text-xs font-medium text-muted-foreground mb-1">
                    Always Excluded
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Temporary files (~$*, *.tmp), system files (.DS_Store, Thumbs.db), and files over 500MB are always excluded.
                  </p>
                </div>
              </TabsContent>

              {/* Synced Folders Tab */}
              <TabsContent value="folders" className="space-y-4 mt-4">
                <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Folder className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900 dark:text-blue-100">Office 365 Folders</p>
                    <p className="text-blue-700 dark:text-blue-300">
                      Enable the folder scopes you want to sync from SharePoint/OneDrive.
                    </p>
                  </div>
                </div>

                {/* Folder Scopes */}
                {folderScopes.length > 0 ? (
                  <div className="space-y-2">
                    {folderScopes.map((scope) => {
                      const IconComponent = scope.icon === "briefcase" ? Briefcase
                        : scope.icon === "building" ? Building2
                        : scope.icon === "users" ? Users
                        : scope.icon === "mail" ? Mail
                        : scope.icon === "clipboard" ? ClipboardList
                        : scope.icon === "warehouse" ? Warehouse
                        : Folder;

                      return (
                        <div
                          key={scope.key}
                          className={cn(
                            "flex items-center justify-between py-3 px-4 rounded-lg border transition-colors",
                            scope.enabled
                              ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                              : "bg-muted/50 border-transparent"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-8 w-8 rounded-lg flex items-center justify-center",
                              scope.enabled
                                ? "bg-green-100 dark:bg-green-900"
                                : "bg-muted"
                            )}>
                              <IconComponent className={cn(
                                "h-4 w-4",
                                scope.enabled
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-muted-foreground"
                              )} />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{scope.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {scope.description}
                              </p>
                              {scope.folderPath && (
                                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                                  /{scope.folderPath.split("/")[0]}
                                </p>
                              )}
                            </div>
                          </div>
                          <Switch
                            checked={scope.enabled}
                            onCheckedChange={(checked) => handleToggleFolderScope(scope.key, checked)}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Folder className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Download TEEEM Sync to configure folders.</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={handleDownloadDesktopApp}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download TEEEM Sync
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Devices Tab */}
              <TabsContent value="devices" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  Desktop devices connected to your account.
                </p>

                {desktopClients.length > 0 ? (
                  <div className="space-y-2">
                    {desktopClients.map((client) => (
                      <div
                        key={client.id}
                        className="flex items-center justify-between py-3 px-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Monitor className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{client.deviceName}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {client.platform}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {client.isActive ? (
                            <Badge variant="outline" className="text-xs text-green-600 dark:text-green-400 border-green-600">
                              <Check className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              Inactive
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(client.lastSeenAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Monitor className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No desktop clients connected.</p>
                    <p className="text-sm mt-1">
                      Download TEEEM Sync to sync files to your desktop.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={handleDownloadDesktopApp}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download TEEEM Sync
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Download TEEEM Sync Modal */}
      <Dialog open={showDownloadModal} onOpenChange={setShowDownloadModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Download TEEEM Sync
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              TEEEM Sync keeps your files synchronized between the cloud and your desktop.
              Select your platform to download.
            </p>

            <div className="grid grid-cols-2 gap-3">
              {/* macOS */}
              <button
                onClick={() => handleDownloadPlatform("mac")}
                className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-accent transition-colors"
              >
                <svg className="h-10 w-10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                <div className="text-center">
                  <p className="font-medium">macOS</p>
                  <p className="text-xs text-muted-foreground">Intel & Apple Silicon</p>
                </div>
              </button>

              {/* Windows */}
              <button
                onClick={() => handleDownloadPlatform("windows")}
                className="flex flex-col items-center gap-3 p-4 rounded-lg border border-border hover:border-primary hover:bg-accent transition-colors"
              >
                <svg className="h-10 w-10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 12V6.75l6-1.32v6.48L3 12zm17-9v8.75l-10 .15V5.21L20 3zM3 13l6 .09v6.81l-6-1.15V13zm7 .25l10 .15V21l-10-1.91V13.25z"/>
                </svg>
                <div className="text-center">
                  <p className="font-medium">Windows</p>
                  <p className="text-xs text-muted-foreground">Windows 10+</p>
                </div>
              </button>
            </div>

            <div className="pt-2 border-t">
              <h4 className="text-sm font-medium mb-2">Features</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-500" />
                  Sync files from Jobs, Companies & Contacts
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-500" />
                  Files On-Demand - download only what you need
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-500" />
                  Automatic conflict resolution
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-500" />
                  Exclude large files (CAD, video, etc.)
                </li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link to Task Dialog - two-step flow: 1) Select task 2) Select question/location */}
      <Dialog
        open={showLinkToTaskDialog}
        onOpenChange={(open) => {
          setShowLinkToTaskDialog(open);
          if (!open) {
            // Reset state when dialog closes
            setSelectedTaskForLink(null);
            setLinkToTaskSearch("");
            setLinkToTaskResults([]);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTaskForLink && (
                <button
                  onClick={() => setSelectedTaskForLink(null)}
                  className="p-1 -ml-1 hover:bg-accent rounded"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <Link2 className="h-5 w-5" />
              {selectedTaskForLink
                ? `Task #${selectedTaskForLink.task_number}`
                : "Link to Task"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Step 1: Search and select task */}
            {!selectedTaskForLink && (
              <>
                <p className="text-sm text-muted-foreground">
                  {isOrphanedDocument(previewDocument)
                    ? "This document is orphaned (original task was deleted). Search for a task to link it to."
                    : "Search for a task to link this document to."}
                </p>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tasks by name or number..."
                    value={linkToTaskSearch}
                    onChange={(e) => {
                      setLinkToTaskSearch(e.target.value);
                      searchTasksForLink(e.target.value);
                    }}
                    className="pl-9"
                  />
                </div>

                {linkToTaskResults.length > 0 && (
                  <div className="border rounded-md max-h-60 overflow-auto">
                    {linkToTaskResults.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => handleSelectTaskForLink(task)}
                        disabled={isLoadingTaskQuestions}
                        className="w-full text-left px-3 py-2 hover:bg-accent flex items-center justify-between group border-b last:border-b-0"
                      >
                        <div>
                          <p className="font-medium text-sm">#{task.task_number} {task.name}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                )}

                {linkToTaskSearch && linkToTaskResults.length === 0 && !isLoadingTaskQuestions && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No tasks found matching &quot;{linkToTaskSearch}&quot;
                  </p>
                )}

                {isLoadingTaskQuestions && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
              </>
            )}

            {/* Step 2: Select question or general attachments */}
            {selectedTaskForLink && (
              <>
                <p className="text-sm text-muted-foreground">
                  Where should this document go?
                </p>

                <div className="border rounded-md max-h-72 overflow-auto">
                  {/* General Attachments option */}
                  <button
                    onClick={() => handleLinkToTask(null)}
                    disabled={isLinkingToTask}
                    className="w-full text-left px-3 py-3 hover:bg-accent flex items-center justify-between group border-b"
                  >
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">General Attachments</p>
                        <p className="text-xs text-muted-foreground">Attach to task without linking to a question</p>
                      </div>
                    </div>
                    <Link2 className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>

                  {/* Questions from the task */}
                  {selectedTaskForLink.action_items
                    .filter(item => item.item_type === "question")
                    .map((item) => {
                      const isAttached = isAlreadyAttachedTo(item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleLinkToTask(item.id)}
                          disabled={isLinkingToTask || isAttached}
                          className={cn(
                            "w-full text-left px-3 py-3 flex items-center justify-between group border-b last:border-b-0",
                            isAttached
                              ? "opacity-50 cursor-not-allowed bg-muted/50"
                              : "hover:bg-accent"
                          )}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <MessageSquare className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{item.text}</p>
                              {isAttached && (
                                <p className="text-xs text-amber-600 dark:text-amber-400">Already attached</p>
                              )}
                            </div>
                          </div>
                          {isAttached ? (
                            <Check className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                          ) : (
                            <Link2 className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}

                  {/* No questions message */}
                  {selectedTaskForLink.action_items.filter(item => item.item_type === "question").length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4 px-3">
                      This task has no questions. Use General Attachments above.
                    </p>
                  )}
                </div>

                {isLinkingToTask && (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Mailbox Drawer - opens when clicking on a mailbox folder */}
      <MailboxDrawer
        mailbox={selectedMailbox || ""}
        open={mailboxDrawerOpen}
        onOpenChange={setMailboxDrawerOpen}
      />
    </div>
  );
}
