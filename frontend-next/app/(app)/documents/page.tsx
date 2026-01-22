"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
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
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { DocumentActions } from "@/components/documents/DocumentActions";
import { formatFileSize } from "@/utils/formatters";

// Types for API response
interface DocumentItem {
  id: number;
  source: "job" | "corporate" | "people" | "task";
  fileName: string;
  displayName: string;
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
  type: "category" | "parent" | "folder" | "file" | "loading";
  children?: TreeNode[];
  file?: DocumentItem;
  icon?: React.ReactNode;
  fileCount?: number;
  // SSoT: Full folder path from Entity Config
  fullPath?: string;
  // SSoT: Folder path template (e.g., "{{CompanyGroup}}/{{CompanyCode}}")
  pathTemplate?: string;
  // Loading state progress
  progress?: { processed: number; total: number; percent: number; remaining_seconds?: number };
}

type ViewMode = "tree" | "list" | "gallery";
type TreeDisplayMode = "list" | "gallery";

// SSoT: Scope hierarchy item from /api/v1/documents/scope_hierarchy
// Matches StorageConfiguration.SCOPE_TEMPLATES structure
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

interface SyncSubscription {
  id: string;
  folderName: string;
  folderType: string;
  lastSyncAt?: string;
}

// SSoT: Scope folder names from StorageConfiguration
interface ScopeFolders {
  job?: string;
  corporate?: string;
  people?: string;
  contact?: string;
  [key: string]: string | undefined;
}

// SSoT: Entity Tab structure from Entity Configurator
interface EntityTabFolder {
  id: number;
  display_name: string;
  scope: string;
  storage_folder_path: string | null;
  icon: string | null;
  is_enabled: boolean;
  document_count?: number;
  children?: EntityTabFolder[];
}

// Icon mapping for all storage scopes - matches StorageConfiguration.SCOPE_FOLDERS
const SCOPE_ICONS: Record<string, React.ReactNode> = {
  job: <Briefcase className="h-4 w-4" />,
  jobs: <Briefcase className="h-4 w-4" />,
  corporate: <Building2 className="h-4 w-4" />,
  corporate_entity: <Building2 className="h-4 w-4" />,
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

// SSoT: Build hierarchical tree from StorageConfiguration.scope_folders
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
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [treeDisplayMode, setTreeDisplayMode] = useState<TreeDisplayMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["job", "corporate", "contact"]));
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<{
    jobs: DocumentItem[];
    corporate: DocumentItem[];
    people: DocumentItem[];
    tasks: DocumentItem[];
  }>({ jobs: [], corporate: [], people: [], tasks: [] });
  // Counts for all scopes - matches StorageConfiguration.SCOPE_FOLDERS
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

  // SSoT: Scope folder names from StorageConfiguration
  // Start empty - API will provide all scopes from StorageConfiguration.SCOPE_FOLDERS
  const [scopeFolders, setScopeFolders] = useState<ScopeFolders>({});

  // SSoT: Folder path templates from Entity Config
  const [scopeTemplates, setScopeTemplates] = useState<Record<string, string>>({});

  // SSoT: Root path from StorageConfiguration
  // Default to empty string - will be populated from API
  // For S3: "/" (bucket root), for SharePoint: "/Shared Documents"
  const [rootPath, setRootPath] = useState<string>("");
  // Phase 4: Virtual scopes (render from DB instead of S3)
  const [virtualScopes, setVirtualScopes] = useState<Record<string, boolean>>({});

  // SSoT: All configured folders from Entity Configurator
  const [entityFolders, setEntityFolders] = useState<{
    job: EntityTabFolder[];
    corporate: EntityTabFolder[];
    contact: EntityTabFolder[];
  }>({ job: [], corporate: [], contact: [] });

  // SSoT: Scope hierarchies from /api/v1/documents/scope_hierarchy
  // These match StorageConfiguration.SCOPE_TEMPLATES ({{CompanyGroup}}/{{CompanyCode}}/{{TabName}})
  const [scopeHierarchies, setScopeHierarchies] = useState<{
    corporate: ScopeHierarchyItem[];
    job: ScopeHierarchyItem[];
    people: ScopeHierarchyItem[];
  }>({ corporate: [], job: [], people: [] });

  // SSoT: S3 folder contents - loaded lazily when expanding folders
  // This mirrors the exact Wasabi/S3 folder structure for OneDrive-like browsing
  const [s3Folders, setS3Folders] = useState<Record<string, {
    folders: Array<{ name: string; path: string; count?: number }>;
    files: Array<{ name: string; path: string; size: number; content_type: string; url?: string; id?: number; type?: string }>;
    loading?: boolean;
    message?: string;
    progress?: { processed: number; total: number; percent: number; remaining_seconds?: number };
  }>>({});
  const [loadingS3Folders, setLoadingS3Folders] = useState<Set<string>>(new Set());

  // Sync settings state
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [desktopClients, setDesktopClients] = useState<DesktopClient[]>([]);
  const [exclusionRules, setExclusionRules] = useState<SyncExclusionRule[]>([]);
  const [subscriptions, setSubscriptions] = useState<SyncSubscription[]>([]);
  const [userOverrides, setUserOverrides] = useState<Record<string, boolean>>({});

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

  // SSoT: Fetch storage config from StorageConfiguration (scope folders, templates, root path)
  // This uses the same endpoint as StorageConfigTab to ensure consistency
  // NOTE: Endpoint name "sharepoint" is legacy - it returns provider-agnostic config from StorageConfiguration
  useEffect(() => {
    const fetchStorageConfig = async () => {
      try {
        const response = await api.get<{
          success: boolean;
          data: {
            scope_folders?: ScopeFolders;
            scope_templates?: Record<string, string>;
            root_path?: string;
            virtual_scopes?: Record<string, boolean>;  // Phase 4
          };
        }>("/api/v1/storage_configuration");
        if (response?.success && response.data) {
          // SSoT: Use scope_folders from StorageConfiguration.SCOPE_FOLDERS
          if (response.data.scope_folders) {
            setScopeFolders(response.data.scope_folders);
          }
          if (response.data.scope_templates) {
            setScopeTemplates(response.data.scope_templates);
          }
          if (response.data.root_path) {
            setRootPath(response.data.root_path);
          }
          // Phase 4: Virtual scopes from StorageConfiguration
          if (response.data.virtual_scopes) {
            setVirtualScopes(response.data.virtual_scopes);
          }
        }
      } catch (err) {
        console.error("Failed to fetch storage config:", err);
      }
    };
    fetchStorageConfig();
  }, []);

  // SSoT: Fetch all configured folders from Entity Configurator
  useEffect(() => {
    const fetchEntityFolders = async () => {
      try {
        // Fetch folders for all scopes in parallel
        const [jobRes, corpRes, contactRes] = await Promise.all([
          api.get<{ success: boolean; data: { tabs: EntityTabFolder[] } }>("/api/v1/entity_tabs?scope=job&include_disabled=false"),
          api.get<{ success: boolean; data: { tabs: EntityTabFolder[] } }>("/api/v1/entity_tabs?scope=corporate_entity&include_disabled=false"),
          api.get<{ success: boolean; data: { tabs: EntityTabFolder[] } }>("/api/v1/entity_tabs?scope=contact&include_disabled=false"),
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
  // These hierarchies match StorageConfiguration.SCOPE_TEMPLATES
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
            displayName: file.name,
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
            displayName: file.name,
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
  const fetchS3Folders = useCallback(async (path: string) => {
    // Already loaded or loading
    if (s3Folders[path] || loadingS3Folders.has(path)) {
      return;
    }

    setLoadingS3Folders(prev => new Set(prev).add(path));
    try {
      // Phase 4: Check if this path belongs to a virtual scope
      const scope = getScopeFromPath(path);
      const isVirtual = scope && virtualScopes[scope];

      if (isVirtual && scope) {
        // Phase 5: Use live_folder_tree - computes folder structure from DB relationships
        // Benefits: Instant template changes, always accurate, single GROUP BY query per level
        const scopeFolder = scopeFolders[scope] || '';
        const relativePath = path.startsWith(scopeFolder + '/')
          ? path.slice(scopeFolder.length + 1)
          : (path === scopeFolder ? '' : path);

        const response = await api.get<{
          success: boolean;
          path: string;
          scope: string;
          template?: string;
          folders: Array<{ name: string; path: string; count: number; [key: string]: unknown }>;
          files: Array<{
            id: number;
            name: string;
            type: string;
            mimeType: string;
            fileSize?: number;
            createdAt?: string;
            receivedAt?: string;
            url?: string;
            [key: string]: unknown;
          }>;
          count: { folders: number; files: number; total: number };
        }>(`/api/v1/documents/live_folder_tree?scope=${encodeURIComponent(scope)}&path=${encodeURIComponent(relativePath)}`);

        if (response?.success) {
          // Map live_folder_tree response to s3_folders format for UI compatibility
          setS3Folders(prev => ({
            ...prev,
            [path]: {
              folders: (response.folders || []).map(f => ({
                name: f.name,
                // Prepend scope folder to make full path
                path: scopeFolder ? `${scopeFolder}/${f.path}` : f.path,
                count: f.count,
              })),
              files: (response.files || []).map(f => ({
                name: f.name,
                path: relativePath ? `${scopeFolder}/${relativePath}/${f.name}` : `${scopeFolder}/${f.name}`,
                size: f.fileSize || 0,
                content_type: f.mimeType || 'application/octet-stream',
                url: f.url,
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
          files: Array<{ name: string; path: string; size: number; content_type: string; last_modified?: string; url?: string }>;
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
              fetchS3Folders(path);
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

  // SSoT: Fetch root S3 folders on page load for Pure S3 Browsing
  // Wasabi = SSoT for DISPLAY (shows actual folder structure)
  // scope_folders = SSoT for STORAGE (where uploads go)
  useEffect(() => {
    // Fetch root folders from Wasabi/S3 to build the tree
    fetchS3Folders("");
  }, [fetchS3Folders]);

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

        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "MyDocs");

        await api.postFormData("/api/v1/documents", formData);
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
      // Fetch exclusion rules
      // skipAuthRedirect: 401 means no desktop client, not session expired
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

  // Filter documents by search query
  const filteredDocuments = useMemo(() => {
    if (!searchQuery) return documents;
    const query = searchQuery.toLowerCase();
    return {
      jobs: documents.jobs.filter(d =>
        d.fileName?.toLowerCase().includes(query) ||
        d.displayName?.toLowerCase().includes(query) ||
        d.jobTitle?.toLowerCase().includes(query)
      ),
      corporate: documents.corporate.filter(d =>
        d.fileName?.toLowerCase().includes(query) ||
        d.displayName?.toLowerCase().includes(query) ||
        d.companyName?.toLowerCase().includes(query)
      ),
      people: documents.people.filter(d =>
        d.fileName?.toLowerCase().includes(query) ||
        d.displayName?.toLowerCase().includes(query) ||
        d.contactName?.toLowerCase().includes(query)
      ),
      tasks: documents.tasks.filter(d =>
        d.fileName?.toLowerCase().includes(query) ||
        d.displayName?.toLowerCase().includes(query) ||
        d.taskName?.toLowerCase().includes(query)
      ),
    };
  }, [documents, searchQuery]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SSoT: PURE S3 BROWSING - Tree shows 100% what's on Wasabi
  // Wasabi = SSoT for DISPLAY (actual folder structure)
  // scope_folders = SSoT for STORAGE (where uploads go, not used for display)
  // ═══════════════════════════════════════════════════════════════════════════
  const treeData = useMemo((): TreeNode[] => {

    // Map folder names to icons for better UX
    const getFolderIcon = (name: string): React.ReactNode => {
      const normalizedName = name.toLowerCase().replace(/[^a-z]/g, '');
      // Check known scope names
      if (normalizedName === 'jobs' || normalizedName === 'job') return SCOPE_ICONS.job;
      if (normalizedName === 'corporate') return SCOPE_ICONS.corporate;
      if (normalizedName === 'people') return SCOPE_ICONS.people;
      if (normalizedName === 'contacts' || normalizedName === 'contact') return SCOPE_ICONS.contact;
      if (normalizedName === 'emails' || normalizedName === 'email') return SCOPE_ICONS.email;
      if (normalizedName === 'attachments') return SCOPE_ICONS.attachments;
      if (normalizedName === 'tasks' || normalizedName === 'task') return SCOPE_ICONS.task;
      if (normalizedName === 'templates') return SCOPE_ICONS.templates;
      if (normalizedName === 'users') return SCOPE_ICONS.users;
      return <Folder className="h-4 w-4" />;
    };

    // Enhanced s3FoldersToTree that adds icons
    const s3FoldersToTreeWithIcons = (s3Path: string): TreeNode[] => {
      const data = s3Folders[s3Path];
      if (!data) return [];

      const folderNodes: TreeNode[] = data.folders.map(folder => {
        // Check if this subfolder has been loaded
        const subfolderData = s3Folders[folder.path];
        const subChildren = subfolderData ? s3FoldersToTreeWithIcons(folder.path) : undefined;

        return {
          id: `s3-folder-${folder.path.replace(/\//g, "-")}`,
          name: folder.name,
          type: "folder" as const,
          icon: getFolderIcon(folder.name),
          children: subChildren,
          // For lazy loading - track the S3 path
          fullPath: folder.path,
          fileCount: subfolderData ? subfolderData.folders.length + subfolderData.files.length : undefined,
        };
      });

      const fileNodes: TreeNode[] = data.files.map(file => ({
        id: `s3-file-${file.path.replace(/\//g, "-")}`,
        name: file.name,
        type: "file" as const,
        file: {
          id: 0, // S3 files don't have database IDs
          source: "corporate" as const,
          fileName: file.name,
          displayName: file.name,
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

      return [...folderNodes, ...fileNodes];
    };

    // Build tree directly from S3 root - shows exactly what's on Wasabi
    const rootData = s3Folders[""];
    if (!rootData) {
      // Root not loaded yet - show loading state or empty
      return [];
    }

    // Check if folder index is being built (first load takes ~90 seconds)
    if (rootData.loading) {
      return [{
        id: "loading-index",
        name: rootData.message || "Building folder index...",
        type: "loading" as const,
        progress: rootData.progress,
      }];
    }

    return s3FoldersToTreeWithIcons("");
  }, [s3Folders]);

  // Toggle folder expansion and fetch S3 folders if needed
  // SSoT: Pure S3 Browsing - ALL folders come from Wasabi
  const toggleFolder = useCallback((folderId: string, folderPath?: string) => {
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

    // If expanding (not collapsing), fetch S3 folder contents
    // SSoT: All folders are S3-driven (Pure S3 Browsing)
    if (!wasExpanded && folderPath) {
      fetchS3Folders(folderPath);
    }
  }, [expandedFolders, fetchS3Folders]);

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

  // Start rename mode
  const handleStartRename = useCallback(() => {
    if (!previewDocument) return;
    setRenameValue(previewDocument.displayName || previewDocument.fileName);
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
    if (newName === previewDocument.displayName || newName === previewDocument.fileName) {
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
          displayName: response.new_name,
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
                  alt={file.displayName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>
            <p className="mt-1 text-xs truncate text-center">{file.displayName}</p>
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
      const S3_SCOPE_IDS = ["job", "corporate", "corporate_entity", "contact", "contacts"];
      if (S3_SCOPE_IDS.includes(node.id)) {
        // Use scopeFolders mapping which gives us just the folder name (e.g., "Jobs")
        const scopePath = scopeFolders[node.id];
        return scopePath || node.name;
      }

      // Helper to strip root path prefix from a path
      // SSoT: rootPath comes from StorageConfiguration (e.g., "/" for S3, "/Shared Documents" for SharePoint)
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
    // Check both folder loading and S3 folder loading states
    const isLoading = loadingFolders.has(node.id) || (folderPath ? loadingS3Folders.has(folderPath) : false);
    const loadedFiles = folderFiles[node.id] || [];
    const hasLoadedFiles = loadedFiles.length > 0;
    // Check if S3 folder data is loaded for this path
    const s3Data = folderPath ? s3Folders[folderPath] : null;
    const hasS3Data = s3Data && (s3Data.folders.length > 0 || s3Data.files.length > 0);

    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center gap-2 py-2 px-3 hover:bg-muted/50 cursor-pointer rounded-md",
            node.type === "category" && "font-semibold"
          )}
          style={{ paddingLeft: `${paddingLeft + 12}px` }}
          onClick={() => toggleFolder(node.id, folderPath)}
          title={node.fullPath || undefined}
        >
          {/* Show chevron if has children OR has files OR is S3-driven folder (expandable) */}
          {(hasChildren || fileCount > 0 || node.id.startsWith("s3-folder-") || ["job", "corporate", "corporate_entity", "contact", "contacts"].includes(node.id)) ? (
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
          {(fileCount > 0 || hasS3Data) && (
            <Badge variant="secondary" className="text-xs">
              {hasS3Data
                ? `${s3Data!.folders.length + s3Data!.files.length} items`
                : `${fileCount} ${fileCount === 1 ? "file" : "files"}`
              }
            </Badge>
          )}
        </div>

        {isExpanded && (hasChildren || hasLoadedFiles || hasS3Data || isLoading) && (
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
                            alt={img.displayName}
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
                    name: file.displayName || file.fileName,
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
        <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center">
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
            <div className="relative w-64">
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
        )}>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : viewMode === "tree" ? (
            // Tree View
            <div className="space-y-1">
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
                    <span className="flex-1 truncate">{doc.displayName || doc.fileName}</span>
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
                            alt={doc.displayName}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <p className="mt-1 text-xs truncate text-center">{doc.displayName}</p>
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
                        {previewDocument.displayName || previewDocument.fileName}
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
                          displayName: previewDocument.displayName,
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
                      alt={previewDocument.displayName}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : previewDocument.mimeType?.includes("pdf") ||
                  previewDocument.fileName?.toLowerCase().endsWith(".pdf") ||
                  previewDocument.displayName?.toLowerCase().endsWith(".pdf") ? (
                  // PDF preview (check mime type OR file extension)
                  <PDFViewer url={previewDocument.fileUrl} className="h-full" />
                ) : previewDocument.mimeType?.includes("wordprocessingml") ||
                  previewDocument.fileName?.toLowerCase().endsWith(".docx") ||
                  previewDocument.displayName?.toLowerCase().endsWith(".docx") ? (
                  // Word document preview using TeeemWord's mammoth conversion
                  <WordDocumentPreview url={previewDocument.fileUrl} className="h-full" />
                ) : previewDocument.mimeType?.includes("spreadsheetml") ||
                  previewDocument.mimeType?.includes("ms-excel") ||
                  previewDocument.fileName?.toLowerCase().endsWith(".xlsx") ||
                  previewDocument.fileName?.toLowerCase().endsWith(".xls") ||
                  previewDocument.displayName?.toLowerCase().endsWith(".xlsx") ||
                  previewDocument.displayName?.toLowerCase().endsWith(".xls") ? (
                  // Excel document preview using TeeemXL
                  <ExcelDocumentPreview url={previewDocument.fileUrl} className="h-full" />
                ) : (
                  // Other file types - show preview placeholder
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                    <File className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium mb-2">{previewDocument.displayName || previewDocument.fileName}</p>
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
                <p className="text-sm text-muted-foreground">
                  Choose which file types to sync to your desktop. Disabled types will appear as placeholders only.
                </p>

                {/* Extension rules */}
                {exclusionRules.filter(r => r.ruleType === "extension").length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground">File Extensions</h3>
                    <div className="space-y-2">
                      {exclusionRules
                        .filter((r) => r.ruleType === "extension")
                        .map((rule) => {
                          const key = `${rule.ruleType}:${rule.value}`;
                          const isEnabled = userOverrides[key] ?? (rule.action === "include");

                          return (
                            <div
                              key={rule.id}
                              className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <File className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <span className="text-sm">{rule.description}</span>
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    ({rule.value})
                                  </span>
                                </div>
                              </div>
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={() => handleToggleExclusion(rule)}
                              />
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Size rules */}
                {exclusionRules.filter(r => r.ruleType === "size").length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground">File Size Limits</h3>
                    <div className="space-y-2">
                      {exclusionRules
                        .filter((r) => r.ruleType === "size")
                        .map((rule) => {
                          const key = `${rule.ruleType}:${rule.value}`;
                          const isEnabled = userOverrides[key] ?? (rule.action === "include");

                          return (
                            <div
                              key={rule.id}
                              className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg"
                            >
                              <div>
                                <span className="text-sm">{rule.description}</span>
                              </div>
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={() => handleToggleExclusion(rule)}
                              />
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Always excluded patterns */}
                {exclusionRules.filter(r => r.ruleType === "pattern").length > 0 && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <h3 className="text-xs font-medium text-muted-foreground mb-1">
                      Always Excluded (System Files)
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {exclusionRules
                        .filter((r) => r.ruleType === "pattern")
                        .map((r) => r.value)
                        .join(", ")}
                    </p>
                  </div>
                )}

                {exclusionRules.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CloudOff className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No sync rules configured yet.</p>
                    <p className="text-sm mt-1">Install the desktop app to configure sync settings.</p>
                  </div>
                )}
              </TabsContent>

              {/* Synced Folders Tab */}
              <TabsContent value="folders" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  Folders currently being synced to your desktop.
                </p>

                {subscriptions.length > 0 ? (
                  <div className="space-y-2">
                    {subscriptions.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between py-3 px-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Folder className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                          <div>
                            <p className="text-sm font-medium">{sub.folderName}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {sub.folderType.replace("_", " ")}
                            </p>
                          </div>
                        </div>
                        {sub.lastSyncAt && (
                          <span className="text-xs text-muted-foreground">
                            Last sync: {new Date(sub.lastSyncAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Folder className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No folders synced yet.</p>
                    <p className="text-sm mt-1">Use the desktop app to select folders to sync.</p>
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
                    <Button variant="outline" className="mt-4" disabled>
                      <Download className="h-4 w-4 mr-2" />
                      Download TEEEM Sync (Coming Soon)
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
