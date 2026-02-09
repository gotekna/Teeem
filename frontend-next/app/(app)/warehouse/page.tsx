"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

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
  Check,
  Loader2,
  Warehouse,
  Mail,
  Paperclip,
  ClipboardList,
  Pencil,
  AlertTriangle,
  Link2,
  ArrowLeft,
  MessageSquare,
  Database,
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
import { WarehouseTree } from "@/components/warehouse/WarehouseTree";
import { WarehouseDocTree } from "@/components/warehouse/WarehouseDocTree";
import type { DocumentItem, TreeDisplayMode } from "@/components/warehouse/types";

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


type ViewMode = "tree" | "list" | "gallery" | "warehouse-tree";


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



export default function AllDocumentsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("tree");
  const [treeDisplayMode, setTreeDisplayMode] = useState<TreeDisplayMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
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

  // Single-click: navigate to full email page for this mailbox
  const handleMailboxClick = useCallback((mailboxEmail: string) => {
    if (mailboxClickTimerRef.current) {
      clearTimeout(mailboxClickTimerRef.current);
    }
    mailboxClickTimerRef.current = setTimeout(() => {
      router.push(`/email?mailbox=${encodeURIComponent(mailboxEmail)}`);
      mailboxClickTimerRef.current = null;
    }, 200);
  }, [router]);

  // Double-click: open mailbox email page in a new tab (bookmarkable)
  const handleMailboxDoubleClick = useCallback((externalLink: string) => {
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
                variant={viewMode === "warehouse-tree" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-none border-x"
                onClick={() => setViewMode("warehouse-tree")}
              >
                <Database className="h-4 w-4 mr-1" />
                Doc Tree
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-none border-r"
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
            // Tree View - SSoT shared component (Feb 2026)
            <div data-tour="warehouse-folders">
              <WarehouseTree
                mode={{ type: "full" }}
                onFileClick={openFileInPopup}
                onFileDoubleClick={openFileInNewWindow}
                onMailboxClick={handleMailboxClick}
                onMailboxDoubleClick={handleMailboxDoubleClick}
                selectedDocument={previewDocument}
                hideToolbar
                treeDisplayMode={treeDisplayMode}
                onTreeDisplayModeChange={(m) => setTreeDisplayMode(m)}
              />
            </div>
          ) : viewMode === "warehouse-tree" ? (
            // Warehouse Doc Tree - simple tree from WarehouseDocument.folder_path
            <div data-tour="warehouse-doc-tree">
              <WarehouseDocTree
                onFileClick={openFileInPopup}
                onFileDoubleClick={openFileInNewWindow}
                onMailboxClick={handleMailboxClick}
                onMailboxDoubleClick={handleMailboxDoubleClick}
                selectedDocument={previewDocument}
              />
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
                (previewDocument.isImage || previewDocument.mimeType?.startsWith("image/")) ? (
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
