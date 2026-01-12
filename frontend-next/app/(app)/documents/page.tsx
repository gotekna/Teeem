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
  counts: {
    jobs: number;
    corporate: number;
    people: number;
    emails: number;
    attachments: number;
    tasks: number;
    templates: number;
    pricebook_images: number;
    total: number;
  };
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

export default function AllDocumentsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [treeDisplayMode, setTreeDisplayMode] = useState<TreeDisplayMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["jobs", "corporate", "people"]));
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<{
    jobs: DocumentItem[];
    corporate: DocumentItem[];
    people: DocumentItem[];
  }>({ jobs: [], corporate: [], people: [] });
  const [counts, setCounts] = useState({ jobs: 0, corporate: 0, people: 0, emails: 0, attachments: 0, tasks: 0, templates: 0, pricebook_images: 0, total: 0 });
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

  // SSoT: Fetch scope folder names from StorageConfiguration
  useEffect(() => {
    const fetchScopeFolders = async () => {
      try {
        const response = await api.get<{
          success: boolean;
          data: { scope_folders?: ScopeFolders };
        }>("/api/v1/corporate_company_settings/sharepoint");
        if (response?.success && response.data?.scope_folders) {
          setScopeFolders(prev => ({ ...prev, ...response.data.scope_folders }));
        }
      } catch (err) {
        console.error("Failed to fetch scope folders:", err);
      }
    };
    fetchScopeFolders();
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
        const defaultCounts = { jobs: 0, corporate: 0, people: 0, emails: 0, attachments: 0, tasks: 0, templates: 0, pricebook_images: 0, total: 0 };
        setCounts(Object.assign({}, defaultCounts, response.counts));
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

  // Build tree structure from Entity Configurator folders (SSoT)
  // Shows ALL configured folders even if empty, with file counts
  const treeData = useMemo((): TreeNode[] => {
    // Helper to recursively build folder tree from EntityTab
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
        };
      });
    };

    // Jobs category - shows all configured job folders
    const jobFolders = entityFolders.job.length > 0
      ? buildFolderTree(entityFolders.job, filteredDocuments.jobs, "job")
      : [];

    const jobsNode: TreeNode = {
      id: "jobs",
      name: scopeFolders.job || "Jobs",
      type: "category",
      icon: <Briefcase className="h-4 w-4" />,
      fileCount: counts.jobs,
      children: jobFolders,
    };

    // Corporate category - shows all configured corporate folders
    const corpFolders = entityFolders.corporate.length > 0
      ? buildFolderTree(entityFolders.corporate, filteredDocuments.corporate, "corp")
      : [];

    const corporateNode: TreeNode = {
      id: "corporate",
      name: scopeFolders.corporate || "Corporate",
      type: "category",
      icon: <Building2 className="h-4 w-4" />,
      fileCount: counts.corporate,
      children: corpFolders,
    };

    // People category - shows all configured contact folders
    const peopleFolders = entityFolders.contact.length > 0
      ? buildFolderTree(entityFolders.contact, filteredDocuments.people, "people")
      : [];

    const peopleNode: TreeNode = {
      id: "people",
      name: scopeFolders.people || scopeFolders.contact || "People",
      type: "category",
      icon: <Users className="h-4 w-4" />,
      fileCount: counts.people,
      children: peopleFolders,
    };

    // Email EML category - stored email files
    const emailsNode: TreeNode = {
      id: "emails",
      name: "Emails",
      type: "category",
      icon: <Mail className="h-4 w-4" />,
      fileCount: counts.emails || 0,
      children: [{
        id: "emails-eml",
        name: "EML Files",
        type: "folder" as const,
        fileCount: counts.emails || 0,
        children: [],
      }],
    };

    // Email Attachments category
    const attachmentsNode: TreeNode = {
      id: "attachments",
      name: "Email Attachments",
      type: "category",
      icon: <Paperclip className="h-4 w-4" />,
      fileCount: counts.attachments || 0,
      children: [],
    };

    // Tasks category - Schedule Master task attachments
    const tasksNode: TreeNode = {
      id: "tasks",
      name: "Tasks",
      type: "category",
      icon: <ClipboardList className="h-4 w-4" />,
      fileCount: counts.tasks || 0,
      children: [],
    };

    // Templates category - Document templates (Word/Excel)
    const templatesNode: TreeNode = {
      id: "templates",
      name: "Templates",
      type: "category",
      icon: <FileText className="h-4 w-4" />,
      fileCount: counts.templates || 0,
      children: [],
    };

    // Pricebook Images category - Product photos
    const pricebookImagesNode: TreeNode = {
      id: "pricebook-images",
      name: "Pricebook Images",
      type: "category",
      icon: <ImageIcon className="h-4 w-4" />,
      fileCount: counts.pricebook_images || 0,
      children: [],
    };

    return [jobsNode, corporateNode, peopleNode, emailsNode, attachmentsNode, tasksNode, templatesNode, pricebookImagesNode];
  }, [filteredDocuments, entityFolders, scopeFolders, counts]);

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
        return (
          <div
            key={node.id}
            className="relative group cursor-pointer"
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
      return (
        <div
          key={node.id}
          className="flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-md group cursor-pointer"
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
          <span className="flex-1">{node.name}</span>
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
                  {images.slice(0, 12).map(img => (
                    <div
                      key={img.id}
                      className="relative group cursor-pointer"
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
                  ))}
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

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 py-4">
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
                  className="flex items-center gap-3 py-2 px-3 hover:bg-muted/50 rounded-md cursor-pointer group"
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
              <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                {allImages.map(doc => (
                  <div
                    key={`gallery-${doc.source}-${doc.id}`}
                    className="group cursor-pointer"
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

      {/* Document Preview Modal */}
      <Dialog open={!!previewDocument} onOpenChange={(open) => !open && setPreviewDocument(null)}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="truncate pr-4">
                {previewDocument?.displayName || previewDocument?.fileName}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {previewDocument?.fileUrl && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => previewDocument?.fileUrl && window.open(previewDocument.fileUrl, "_blank")}
                    >
                      <Maximize2 className="h-4 w-4 mr-1" />
                      Full Screen
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (previewDocument?.fileUrl) {
                          const link = document.createElement('a');
                          link.href = previewDocument.fileUrl;
                          link.download = previewDocument.displayName || previewDocument.fileName;
                          link.click();
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </>
                )}
              </div>
            </div>
            {/* Document metadata */}
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              {previewDocument?.source === "job" && previewDocument?.jobNumber && (
                <Badge variant="outline" className="text-xs">Job {previewDocument.jobNumber}</Badge>
              )}
              {previewDocument?.source === "corporate" && previewDocument?.companyName && (
                <Badge variant="outline" className="text-xs">{previewDocument.companyName}</Badge>
              )}
              {previewDocument?.source === "people" && previewDocument?.contactName && (
                <Badge variant="outline" className="text-xs">{previewDocument.contactName}</Badge>
              )}
              {previewDocument?.storageProvider === "s3_compatible" && (
                <Badge variant="secondary" className="text-xs">S3</Badge>
              )}
              {previewDocument?.fileSize && previewDocument.fileSize > 0 && (
                <span>{formatFileSize(previewDocument.fileSize)}</span>
              )}
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto bg-muted dark:bg-background">
            {previewDocument?.fileUrl ? (
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
                // Other file types - show download option
                <div className="h-full flex flex-col items-center justify-center p-8">
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
        </DialogContent>
      </Dialog>

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
