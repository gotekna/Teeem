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
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PDFViewer } from "@/components/ui/pdf-viewer";
import { BackButton } from "@/components/ui/back-button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// Types for API response
interface DocumentItem {
  id: number;
  source: "job" | "corporate" | "people";
  fileName: string;
  displayName: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string | null;
  folderPath: string | null;
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
  };
  // Counts for all scopes - dynamic, extends as new scopes are added
  counts: Record<string, number>;
}

// Tree node structure
interface TreeNode {
  id: string;
  name: string;
  type: "category" | "parent" | "folder" | "file";
  children?: TreeNode[];
  file?: DocumentItem;
  icon?: React.ReactNode;
  fileCount?: number;
  // SSoT: Full folder path from Entity Config
  fullPath?: string;
  // SSoT: Folder path template (e.g., "{{CompanyGroup}}/{{CompanyCode}}")
  pathTemplate?: string;
}

type ViewMode = "tree" | "list" | "gallery";
type TreeDisplayMode = "list" | "gallery";

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

// Build hierarchical tree from scope folders
// e.g., "Users/Photos" becomes child of "Users"
// This dynamically generates the tree from StorageConfiguration.scope_folders
const buildScopeTree = (
  scopes: Record<string, string>,
  counts: Record<string, number>,
  templates: Record<string, string> = {},
  rootPath: string = "/Shared Documents"
): TreeNode[] => {
  const tree: TreeNode[] = [];
  const parentMap: Record<string, TreeNode> = {};
  const seenPaths = new Set<string>();

  // Preferred keys when there are duplicates (canonical name for each path)
  const preferredKeys: Record<string, string> = {
    "Jobs": "job",
    "Corporate": "corporate",
    "Contacts": "contact",
    "Warehousing/Tasks": "task",
    "Warehousing/BillInbox": "bill_inbox",
    "Warehousing/Pricebook Photos": "pricebook_photos",
    "Emails/eml": "email",
    "Emails/attachments": "email_attachments",
    "ActiveStorage": "active_storage",
    "Accounts": "account",
  };

  // Keys to skip - legacy aliases that may still exist in some database records
  // Backend SCOPE_FOLDERS is now clean, but database scope_folders may have old keys
  const skipKeys = new Set([
    "jobs", "emails", "contacts", "tasks", "attachments", "warehousing",
    "pricebook_images", "billinbox", "pricebook", "accounts", "account",
    "company", "corporate_entity"
  ]);

  // First pass: collect unique paths and determine which key to use
  const pathToKey: Record<string, string> = {};
  for (const [key, path] of Object.entries(scopes)) {
    if (skipKeys.has(key)) continue;
    // Use preferred key if available, otherwise first one wins
    if (!pathToKey[path] || preferredKeys[path] === key) {
      pathToKey[path] = key;
    }
  }

  // Get unique entries sorted by depth (parents before children)
  const uniqueEntries = Object.entries(pathToKey)
    .map(([path, key]) => [key, path] as [string, string])
    .sort((a, b) => {
      const depthA = a[1].split("/").length;
      const depthB = b[1].split("/").length;
      if (depthA !== depthB) return depthA - depthB;
      return a[1].localeCompare(b[1]);
    });

  // Create parent folders that don't exist (e.g., "Emails" for "Emails/eml")
  const ensureParentExists = (path: string) => {
    const parts = path.split("/");
    if (parts.length <= 1) return;

    let currentPath = "";
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      if (!parentMap[currentPath]) {
        // Create synthetic parent node
        const parentNode: TreeNode = {
          id: `parent-${currentPath.replace(/\//g, "-").toLowerCase()}`,
          name: parts[i],
          type: "category",
          icon: <Folder className="h-4 w-4" />,
          fileCount: 0,
          children: [],
        };

        if (i === 0) {
          tree.push(parentNode);
        } else {
          const grandParentPath = parts.slice(0, i).join("/");
          const grandParent = parentMap[grandParentPath];
          if (grandParent?.children) {
            grandParent.children.push(parentNode);
          }
        }
        parentMap[currentPath] = parentNode;
      }
    }
  };

  for (const [key, path] of uniqueEntries) {
    // Skip if we've already processed this path
    if (seenPaths.has(path)) continue;
    seenPaths.add(path);

    const parts = path.split("/");
    const displayName = parts[parts.length - 1];

    // Ensure parent folders exist
    ensureParentExists(path);

    // Map scope key to count key
    const countKey = key === "job" ? "jobs"
      : key === "corporate" ? "corporate"
      : key === "email" ? "emails"
      : key === "email_attachments" ? "email_attachments"
      : key === "task" ? "tasks"
      : key === "pricebook_photos" ? "pricebook_images"
      : key;

    // Get template for this scope (SSoT from Entity Config)
    const template = templates[key] || "";
    // Build full path: rootPath + scopePath + template
    const fullPath = template
      ? `${rootPath}/${path}/${template}`
      : `${rootPath}/${path}`;

    const node: TreeNode = {
      id: key,
      name: displayName,
      type: "category",
      icon: SCOPE_ICONS[key] || <Folder className="h-4 w-4" />,
      fileCount: counts[countKey] || 0,
      children: [],
      fullPath: fullPath,
      pathTemplate: template || undefined,
    };

    if (parts.length === 1) {
      // Root level scope
      tree.push(node);
      parentMap[path] = node;
    } else {
      // Nested scope - find parent
      const parentPath = parts.slice(0, -1).join("/");
      const parent = parentMap[parentPath];
      if (parent?.children) {
        parent.children.push(node);
        // Update parent's file count to include children
        parent.fileCount = (parent.fileCount || 0) + (node.fileCount || 0);
      } else {
        // Parent not found, add to root
        tree.push(node);
      }
      parentMap[path] = node;
    }
  }

  return tree;
};

export default function AllDocumentsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [treeDisplayMode, setTreeDisplayMode] = useState<TreeDisplayMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["job", "corporate", "contact"]));
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<{
    jobs: DocumentItem[];
    corporate: DocumentItem[];
    people: DocumentItem[];
  }>({ jobs: [], corporate: [], people: [] });
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

  // SSoT: Scope folder names from StorageConfiguration
  const [scopeFolders, setScopeFolders] = useState<ScopeFolders>({
    job: "Jobs",
    corporate: "Corporate",
    people: "People",
    contact: "Contacts",
  });

  // SSoT: Folder path templates from Entity Config
  const [scopeTemplates, setScopeTemplates] = useState<Record<string, string>>({});

  // SSoT: Root path from StorageConfiguration
  const [rootPath, setRootPath] = useState<string>("/Shared Documents");

  // SSoT: All configured folders from Entity Configurator
  const [entityFolders, setEntityFolders] = useState<{
    job: EntityTabFolder[];
    corporate: EntityTabFolder[];
    contact: EntityTabFolder[];
  }>({ job: [], corporate: [], contact: [] });

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

  // SSoT: Fetch storage config from StorageConfiguration (scope folders, templates, root path)
  useEffect(() => {
    const fetchStorageConfig = async () => {
      try {
        const response = await api.get<{
          success: boolean;
          data: {
            scope_folders?: ScopeFolders;
            scope_templates?: Record<string, string>;
            root_path?: string;
          };
        }>("/api/v1/corporate_company_settings/sharepoint");
        if (response?.success && response.data) {
          if (response.data.scope_folders) {
            setScopeFolders(prev => ({ ...prev, ...response.data.scope_folders }));
          }
          if (response.data.scope_templates) {
            setScopeTemplates(response.data.scope_templates);
          }
          if (response.data.root_path) {
            setRootPath(response.data.root_path);
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
    };
  }, [documents, searchQuery]);

  // Build tree structure dynamically from StorageConfiguration.scope_folders (SSoT)
  // Shows ALL configured scopes even if empty, with nested hierarchy
  const treeData = useMemo((): TreeNode[] => {
    // Helper to recursively build folder tree from EntityTab (for sub-folders)
    const buildFolderTree = (
      tabs: EntityTabFolder[],
      docs: DocumentItem[],
      scopePrefix: string
    ): TreeNode[] => {
      return tabs.map(tab => {
        // Count files matching this folder path
        const folderPath = tab.storage_folder_path || tab.display_name;
        const matchingDocs = docs.filter(d =>
          d.folderPath === folderPath ||
          d.folderPath === tab.display_name ||
          d.documentTypeName === tab.display_name
        );

        // Build children if any
        const childNodes = tab.children && tab.children.length > 0
          ? buildFolderTree(tab.children, docs, scopePrefix)
          : matchingDocs.map(file => ({
              id: `${scopePrefix}-file-${file.id}`,
              name: file.displayName || file.fileName,
              type: "file" as const,
              file,
            }));

        // Calculate total file count including children
        const childFileCount = tab.children && tab.children.length > 0
          ? childNodes.reduce((sum, c) => sum + ('fileCount' in c ? (c.fileCount || 0) : 1), 0)
          : matchingDocs.length;

        return {
          id: `${scopePrefix}-folder-${tab.id}`,
          name: tab.display_name,
          type: "folder" as const,
          fileCount: tab.document_count ?? childFileCount,
          children: childNodes,
          // SSoT: Include storage folder path from EntityTab
          fullPath: tab.storage_folder_path || undefined,
        };
      });
    };

    // Use dynamic tree building from scope_folders
    // This reads from StorageConfiguration and builds nested hierarchy
    // Filter out undefined values from scopeFolders
    const definedScopes = Object.fromEntries(
      Object.entries(scopeFolders).filter((entry): entry is [string, string] => entry[1] !== undefined)
    );
    // Pass templates and rootPath from Entity Config (SSoT)
    const dynamicTree = buildScopeTree(definedScopes, counts, scopeTemplates, rootPath);

    // Enhance specific nodes with EntityTab-based sub-folders
    // (Jobs, Corporate, People have EntityTab configurations for their internal folder structure)
    return dynamicTree.map(node => {
      if (node.id === "job" && entityFolders.job.length > 0) {
        return {
          ...node,
          children: buildFolderTree(entityFolders.job, filteredDocuments.jobs, "job"),
        };
      }
      if ((node.id === "corporate" || node.id === "corporate_entity") && entityFolders.corporate.length > 0) {
        // For corporate, add entity tab children but keep nested scopes (like People)
        const corpChildren = buildFolderTree(entityFolders.corporate, filteredDocuments.corporate, "corp");
        return {
          ...node,
          children: [...corpChildren, ...(node.children || [])],
        };
      }
      if (node.id === "contact" && entityFolders.contact.length > 0) {
        return {
          ...node,
          children: buildFolderTree(entityFolders.contact, filteredDocuments.people, "contact"),
        };
      }
      return node;
    });
  }, [filteredDocuments, entityFolders, scopeFolders, scopeTemplates, rootPath, counts]);

  // Toggle folder expansion
  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

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

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  // Render tree node recursively
  const renderTreeNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(node.id);
    const paddingLeft = depth * 20;

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
            <ImageIcon className="h-4 w-4 text-blue-500" />
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

    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center gap-2 py-2 px-3 hover:bg-muted/50 cursor-pointer rounded-md",
            node.type === "category" && "font-semibold"
          )}
          style={{ paddingLeft: `${paddingLeft + 12}px` }}
          onClick={() => toggleFolder(node.id)}
          title={node.fullPath || undefined}
        >
          {hasChildren && (
            <ChevronRight
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                isExpanded && "rotate-90"
              )}
            />
          )}
          {node.type === "category" && node.icon}
          {node.type !== "category" && (
            <Folder className="h-4 w-4 text-yellow-500" />
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
          <Badge variant="secondary" className="text-xs">
            {fileCount} {fileCount === 1 ? "file" : "files"}
          </Badge>
        </div>

        {isExpanded && hasChildren && (
          <div className={cn(depth > 0 && "border-l border-muted ml-6")}>
            {treeDisplayMode === "gallery" && images.length > 0 ? (
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
              // Standard list view
              node.children?.map(child => renderTreeNode(child, depth + 1))
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
    ];
  }, [filteredDocuments]);

  // All images for gallery view
  const allImages = useMemo(() => {
    return allDocumentsFlat.filter(d => d.isImage);
  }, [allDocumentsFlat]);

  return (
    <div className="flex flex-col h-full -mx-4">
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
                      <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" />
                    ) : (
                      <File className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="flex-1 truncate">{doc.displayName || doc.fileName}</span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {doc.source === "job" && doc.jobNumber && `Job ${doc.jobNumber}`}
                      {doc.source === "corporate" && doc.companyName}
                      {doc.source === "people" && doc.contactName}
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
                  <h3 className="font-medium truncate">
                    {previewDocument.displayName || previewDocument.fileName}
                  </h3>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = previewDocument.fileUrl!;
                          link.download = previewDocument.displayName || previewDocument.fileName;
                          link.click();
                        }}
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPreviewDocument(null)}
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
                ) : previewDocument.mimeType?.includes("pdf") ? (
                  // PDF preview
                  <PDFViewer url={previewDocument.fileUrl} className="h-full" />
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
                    <h3 className="text-sm font-medium">File Extensions</h3>
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
                    <h3 className="text-sm font-medium">File Size Limits</h3>
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
                          <Folder className="h-4 w-4 text-blue-500" />
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
                            <Badge variant="outline" className="text-xs text-green-600 border-green-600">
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
