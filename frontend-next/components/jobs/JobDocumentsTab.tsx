"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Folder,
  Upload,
  ExternalLink,
  Cloud,
  CheckCircle,
  AlertCircle,
  FileText,
  Paperclip,
  Eye,
  Calendar,
  ShieldCheck,
  Settings,
  RefreshCw,
  Loader2,
  ChevronRight,
  ArrowLeft,
  File,
  Download,
  FolderInput,
  X,
  Sparkles,
  Check,
  ArrowRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";

interface OrgStatus {
  loading: boolean;
  connected: boolean;
  rootFolderPath?: string;
}

interface JobFolderStatus {
  loading: boolean;
  exists: boolean;
  webUrl: string | null;
  jobFolderId?: string;
}

interface OneDriveItem {
  id: string;
  name: string;
  webUrl: string;
  lastModifiedDateTime?: string;
  folder?: {
    childCount: number;
  };
  file?: {
    mimeType: string;
  };
  size?: number;
}

interface OneDriveFolder {
  id: string;
  name: string;
  webUrl: string;
  lastModifiedDateTime?: string;
  folder?: {
    childCount: number;
  };
}

interface FolderPath {
  id: string;
  name: string;
}

interface DocumentCategory {
  id: number;
  name: string;
  document_count?: number;
  icon?: string;
  color?: string;
  description?: string;
  sequence_order?: number;
  is_active?: boolean;
  folder_path?: string;
  children?: DocumentCategory[];
}

interface DocumentTask {
  id: number;
  name: string;
  description: string;
  required: boolean;
  has_document: boolean;
  is_validated: boolean;
  document_url: string | null;
  uploaded_at: string | null;
  validated_at: string | null;
  validated_by: string | null;
}

interface LegacyItem {
  id: string;
  document_id?: number;
  name: string;
  original_name?: string;
  size?: number;
  web_url?: string;
  modified?: string;
  type: "file" | "folder";
  child_count?: number;
  folder_path?: string; // Path to the file's parent folder (for recursive listing)
  // AI analysis fields
  ai_analyzed?: boolean;
  ai_analyzed_at?: string;
  ai_suggested_type_id?: number;
  ai_suggested_type_name?: string;
  ai_proposed_name?: string;
  ai_confidence?: number;
  ai_reasoning?: string;
  rename_status?: string;
}

interface AIStats {
  total: number;
  analyzed: number;
  unanalyzed: number;
  pending_review: number;
  approved: number;
  rejected: number;
}

interface JobDocumentsTabProps {
  jobId: string | number;
  jobTitle?: string;
}

// Plan file interface
interface PlanFile {
  id: string;
  name: string;
  web_url: string;
  size?: number;
  modified?: string;
  is_all_plans: boolean;
}

export function JobDocumentsTab({ jobId, jobTitle }: JobDocumentsTabProps) {
  const [viewMode, setViewMode] = useState<"tasks" | "onedrive" | "allfiles" | "plans">("tasks");
  const [orgStatus, setOrgStatus] = useState<OrgStatus>({ loading: true, connected: false });
  const [jobFolderStatus, setJobFolderStatus] = useState<JobFolderStatus>({ loading: false, exists: false, webUrl: null });
  const [folders, setFolders] = useState<OneDriveFolder[]>([]);
  const [creatingFolders, setCreatingFolders] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const [documentCategories, setDocumentCategories] = useState<DocumentCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<DocumentCategory | null>(null);
  const [tasks, setTasks] = useState<DocumentTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFolderId, setUploadFolderId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<FolderPath[]>([]);
  const [folderContents, setFolderContents] = useState<OneDriveItem[]>([]);
  const [loadingContents, setLoadingContents] = useState(false);

  // Legacy import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [legacyItems, setLegacyItems] = useState<LegacyItem[]>([]);
  const [loadingLegacy, setLoadingLegacy] = useState(false);
  const [selectedLegacyFiles, setSelectedLegacyFiles] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  // All Files tab state
  const [allFiles, setAllFiles] = useState<LegacyItem[]>([]);
  const [loadingAllFiles, setLoadingAllFiles] = useState(false);
  const [allFilesJobFolderUrl, setAllFilesJobFolderUrl] = useState<string | null>(null);
  const [aiStats, setAiStats] = useState<AIStats | null>(null);
  const [analyzingDocs, setAnalyzingDocs] = useState(false);
  const [approvingDoc, setApprovingDoc] = useState<number | null>(null);

  // Plans tab state
  const [plans, setPlans] = useState<PlanFile[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [uploadingPlan, setUploadingPlan] = useState(false);
  const [plansFolderUrl, setPlansFolderUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanFile | null>(null);

  useEffect(() => {
    checkOrganizationStatus();
    loadDocumentCategories();
     
  }, [jobId]);

  useEffect(() => {
    // When a parent category is selected, auto-select the first child (or the parent itself if no children)
    if (selectedCategory) {
      if (selectedCategory.children && selectedCategory.children.length > 0) {
        setSelectedSubCategory(selectedCategory.children[0]);
      } else {
        setSelectedSubCategory(null);
        loadDocumentTasks(selectedCategory.id);
      }
    }
     
  }, [selectedCategory]);

  useEffect(() => {
    // Load tasks for the selected subcategory
    if (selectedSubCategory) {
      loadDocumentTasks(selectedSubCategory.id);
    }
     
  }, [selectedSubCategory]);

  const checkOrganizationStatus = async () => {
    try {
      setOrgStatus({ loading: true, connected: false });
      setError(null);

      const response = await api.get<{ connected: boolean; root_folder_path?: string }>(
        "/api/v1/organization_onedrive/status"
      );

      setOrgStatus({
        loading: false,
        connected: response?.connected || false,
        rootFolderPath: response?.root_folder_path,
      });

      if (response?.connected) {
        await checkJobFolderStatus();
      }
    } catch (err) {
      console.error("Failed to check organization OneDrive status:", err);
      setOrgStatus({ loading: false, connected: false });
    }
  };

  const checkJobFolderStatus = async () => {
    try {
      setJobFolderStatus({ loading: true, exists: false, webUrl: null });

      const response = await api.get<{
        job_folder_web_url?: string;
        job_folder_id?: string;
        items?: OneDriveFolder[];
      }>(`/api/v1/organization_onedrive/job_folders?job_id=${jobId}`);

      if (response) {
        setJobFolderStatus({
          loading: false,
          exists: true,
          webUrl: response.job_folder_web_url || null,
          jobFolderId: response.job_folder_id,
        });

        const items = response.items || [];
        const folderItems = items.filter((item) => item.folder);
        setFolders(folderItems);
      }
    } catch (err: unknown) {
      const error = err as { response?: { status?: number } };
      if (error.response?.status === 404) {
        setJobFolderStatus({ loading: false, exists: false, webUrl: null });
      } else {
        console.error("Failed to check job folder status:", err);
      }
    }
  };

  const loadDocumentCategories = async () => {
    try {
      const response = await api.get<DocumentCategory[]>(`/api/v1/jobs/${jobId}/documentation_tabs`);
      const categories = response || [];
      setDocumentCategories(categories);
      if (categories.length > 0 && !selectedCategory) {
        setSelectedCategory(categories[0]);
      }
    } catch (err) {
      console.error("Failed to load document categories:", err);
    }
  };

  const loadDocumentTasks = async (categoryId: number) => {
    try {
      setLoadingTasks(true);
      const response = await api.get<{ tasks: DocumentTask[] }>(
        `/api/v1/jobs/${jobId}/document_tasks?category=${categoryId}`
      );
      setTasks(response?.tasks || []);
    } catch (err) {
      console.error("Failed to load document tasks:", err);
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleCreateFolders = async () => {
    try {
      setCreatingFolders(true);
      setError(null);
      setMessage(null);

      const response = await api.post<{ message?: string }>(
        `/api/v1/organization_onedrive/create_job_folders?job_id=${jobId}`
      );

      setMessage({
        type: "success",
        text: response?.message || "Folder structure created successfully!",
      });

      await checkJobFolderStatus();
    } catch (err) {
      console.error("Failed to create folders:", err);
      setError("Failed to create folder structure");
    } finally {
      setCreatingFolders(false);
    }
  };

  const handleUpload = (folderId: string) => {
    setUploadFolderId(folderId);
    fileInputRef.current?.click();
  };

  const loadFolderContents = async (folderId: string, folderName: string) => {
    try {
      setLoadingContents(true);
      const response = await api.get<{ items: OneDriveItem[] }>(
        `/api/v1/organization_onedrive/folder_contents?folder_id=${folderId}&job_id=${jobId}`
      );

      setFolderContents(response?.items || []);
      setCurrentFolderId(folderId);
      setFolderPath((prev) => [...prev, { id: folderId, name: folderName }]);
    } catch (err) {
      console.error("Failed to load folder contents:", err);
      setError("Failed to load folder contents");
    } finally {
      setLoadingContents(false);
    }
  };

  const navigateBack = () => {
    if (folderPath.length <= 1) {
      // Go back to folder list
      setCurrentFolderId(null);
      setFolderPath([]);
      setFolderContents([]);
    } else {
      // Go up one level
      const newPath = folderPath.slice(0, -2);
      const parentFolder = folderPath[folderPath.length - 2];
      setFolderPath(newPath);
      loadFolderContents(parentFolder.id, parentFolder.name);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !uploadFolderId) return;

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("job_id", String(jobId));
      formData.append("folder_id", uploadFolderId);

      await api.postFormData("/api/v1/organization_onedrive/upload", formData);

      setMessage({ type: "success", text: `File "${file.name}" uploaded successfully!` });
      await checkJobFolderStatus();
    } catch (err) {
      console.error("Failed to upload file:", err);
      setError("Failed to upload file");
    } finally {
      setUploadFolderId(null);
      if (event.target) event.target.value = "";
    }
  };

  const handleTaskUpload = async (taskId: number, file: File) => {
    try {
      setUploading(taskId);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("task_id", String(taskId));
      formData.append("construction_id", String(jobId));
      formData.append("category", String(selectedCategory?.id));

      const response = await api.postFormData<{ document_url: string; uploaded_at: string }>(
        `/api/v1/jobs/${jobId}/document_tasks/${taskId}/upload`,
        formData
      );

      if (response) {
        setTasks((prev) =>
          prev.map((task) =>
            task.id === taskId
              ? { ...task, has_document: true, document_url: response.document_url, uploaded_at: response.uploaded_at }
              : task
          )
        );
      }
    } catch (err) {
      console.error("Failed to upload document:", err);
      setError("Failed to upload document");
    } finally {
      setUploading(null);
    }
  };

  const handleValidate = async (taskId: number) => {
    try {
      const response = await api.post<{ validated_at: string; validated_by: string }>(
        `/api/v1/jobs/${jobId}/document_tasks/${taskId}/validate`
      );

      if (response) {
        setTasks((prev) =>
          prev.map((task) =>
            task.id === taskId
              ? { ...task, is_validated: true, validated_at: response.validated_at, validated_by: response.validated_by }
              : task
          )
        );
      }
    } catch (err) {
      console.error("Failed to validate document:", err);
    }
  };

  // Load legacy files from the old SharePoint folder
  // Always loads recursively to get ALL files from all subfolders
  const loadLegacyFiles = async () => {
    try {
      setLoadingLegacy(true);
      setError(null);
      // Always request recursive=true to get all files from all subfolders
      const url = `/api/v1/organization_onedrive/legacy_files?job_id=${jobId}&recursive=true`;
      console.log('[Legacy Import] Fetching:', url);

      const response = await api.get<{
        success: boolean;
        items: LegacyItem[];
        count: number;
        source_folder: string;
        recursive: boolean;
        error?: string;
      }>(url);

      console.log('[Legacy Import] Response:', response);

      if (response?.success) {
        console.log('[Legacy Import] Found', response.items?.length || 0, 'files');
        setLegacyItems(response.items || []);
        setSelectedLegacyFiles([]);
      } else {
        console.error('[Legacy Import] API returned error:', response?.error || 'Unknown error');
        setError(response?.error || 'Failed to load legacy files');
        setLegacyItems([]);
      }
    } catch (err) {
      console.error("[Legacy Import] Exception:", err);
      setError(err instanceof Error ? err.message : 'Failed to load legacy files');
      setLegacyItems([]);
    } finally {
      setLoadingLegacy(false);
    }
  };


  // Import selected legacy files to the job folder
  const handleImportLegacy = async () => {
    if (selectedLegacyFiles.length === 0) return;

    try {
      setImporting(true);
      setError(null);

      const response = await api.post<{
        success: boolean;
        message: string;
        imported: { file_id: string; name: string; category: string }[];
        errors: { file_id: string; error: string }[];
      }>("/api/v1/organization_onedrive/import_legacy", {
        job_id: jobId,
        file_ids: selectedLegacyFiles,
      });

      if (response?.success) {
        setMessage({
          type: "success",
          text: response.message || `Imported ${response.imported?.length || 0} files successfully!`,
        });
        setShowImportModal(false);
        setSelectedLegacyFiles([]);
        // Refresh the folder list
        await checkJobFolderStatus();
      } else {
        setError(response?.errors?.map((e) => e.error).join(", ") || "Import failed");
      }
    } catch (err) {
      console.error("Failed to import legacy files:", err);
      setError("Failed to import files. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  // Open import modal and load files
  const openImportModal = async () => {
    setShowImportModal(true);
    await loadLegacyFiles();
  };

  // Toggle file selection (files only, not folders)
  const toggleFileSelection = useCallback((fileId: string) => {
    console.log('[Legacy Import] toggleFileSelection called with:', fileId);
    setSelectedLegacyFiles((prev) => {
      const newSelection = prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId];
      console.log('[Legacy Import] Selection updated:', newSelection.length, 'files');
      return newSelection;
    });
  }, []);

  // Select all files (only files, not folders)
  const selectAllFiles = () => {
    // All items are files now (recursive listing returns only files)
    if (selectedLegacyFiles.length === legacyItems.length && legacyItems.length > 0) {
      setSelectedLegacyFiles([]);
    } else {
      setSelectedLegacyFiles(legacyItems.map((f) => f.id));
    }
  };

  // Load all files in the job folder (for All Files tab)
  const loadAllFiles = async () => {
    try {
      setLoadingAllFiles(true);
      setError(null);
      const url = `/api/v1/organization_onedrive/job_all_files?job_id=${jobId}`;
      console.log('[All Files] Fetching:', url);

      const response = await api.get<{
        success: boolean;
        items: LegacyItem[];
        count: number;
        job_folder_web_url?: string;
        ai_stats?: AIStats;
        error?: string;
      }>(url);

      console.log('[All Files] Response:', response);

      if (response?.success) {
        console.log('[All Files] Found', response.items?.length || 0, 'files');
        setAllFiles(response.items || []);
        setAllFilesJobFolderUrl(response.job_folder_web_url || null);
        setAiStats(response.ai_stats || null);
      } else {
        console.log('[All Files] No job folder or empty:', response?.error);
        setAllFiles([]);
        setAllFilesJobFolderUrl(null);
        setAiStats(null);
      }
    } catch (err) {
      console.error("[All Files] Exception:", err);
      setError(err instanceof Error ? err.message : 'Failed to load files');
      setAllFiles([]);
    } finally {
      setLoadingAllFiles(false);
    }
  };

  // Trigger AI analysis for documents
  const handleAnalyzeDocuments = async () => {
    try {
      setAnalyzingDocs(true);
      setError(null);

      const response = await api.post<{
        success: boolean;
        message: string;
        queued_count?: number;
        total_unanalyzed?: number;
      }>(`/api/v1/organization_onedrive/analyze_job_documents`, {
        job_id: jobId,
        limit: 25,
      });

      if (response?.success) {
        setMessage({ type: "success", text: response.message });
        // Refresh after a short delay to see updated data
        setTimeout(loadAllFiles, 2000);
      }
    } catch (err) {
      console.error("Failed to start AI analysis:", err);
      setError("Failed to start AI analysis");
    } finally {
      setAnalyzingDocs(false);
    }
  };

  // Approve or reject a document rename
  const handleApproveRename = async (documentId: number, action: "approve" | "reject") => {
    try {
      setApprovingDoc(documentId);
      setError(null);

      const response = await api.post<{
        success: boolean;
        message: string;
        new_name?: string;
      }>(`/api/v1/organization_onedrive/approve_document_rename`, {
        document_id: documentId,
        action,
      });

      if (response?.success) {
        setMessage({ type: "success", text: response.message });
        // Update the local state
        setAllFiles(prev => prev.map(f =>
          f.document_id === documentId
            ? { ...f, rename_status: action === "approve" ? "completed" : "rejected", name: response.new_name || f.name }
            : f
        ));
        // Update AI stats
        if (aiStats) {
          setAiStats({
            ...aiStats,
            pending_review: aiStats.pending_review - 1,
            [action === "approve" ? "approved" : "rejected"]: (aiStats[action === "approve" ? "approved" : "rejected"] || 0) + 1,
          });
        }
      }
    } catch (err) {
      console.error("Failed to approve/reject rename:", err);
      setError("Failed to process rename action");
    } finally {
      setApprovingDoc(null);
    }
  };

  // Load all files when switching to the All Files tab
  useEffect(() => {
    if (viewMode === "allfiles" && orgStatus.connected) {
      loadAllFiles();
    }

  }, [viewMode, orgStatus.connected]);

  // Load plans when switching to the Plans tab
  useEffect(() => {
    if (viewMode === "plans" && orgStatus.connected) {
      loadPlans();
    }
  }, [viewMode, orgStatus.connected]);

  // Load plans from 04 Plans folder
  const loadPlans = async () => {
    try {
      setLoadingPlans(true);
      const response = await api.get<{
        success: boolean;
        data: {
          plans: PlanFile[];
          folder_exists: boolean;
          folder_web_url?: string;
        };
      }>(`/api/v1/jobs/${jobId}/plan_set`);

      if (response.success && response.data) {
        setPlans(response.data.plans || []);
        setPlansFolderUrl(response.data.folder_web_url || null);
      }
    } catch (err) {
      console.error("Failed to load plans:", err);
      setError("Failed to load plans");
    } finally {
      setLoadingPlans(false);
    }
  };

  // Upload a plan set PDF
  const uploadPlanSet = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a PDF file");
      return;
    }

    try {
      setUploadingPlan(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", file);

      const response = await api.postFormData<{
        success: boolean;
        error?: string;
        data?: {
          all_plans: { name: string; file_id: string; web_url: string };
          pages: Array<{ name: string; file_id: string; web_url: string }>;
          total_pages: number;
        };
      }>(`/api/v1/jobs/${jobId}/upload_plan_set`, formData);

      if (response.success) {
        setMessage({
          type: "success",
          text: `Successfully uploaded ${response.data?.total_pages || 0} plan pages`,
        });
        // Reload plans list
        loadPlans();
      } else {
        setError(response.error || "Failed to upload plan set");
      }
    } catch (err) {
      console.error("Failed to upload plan set:", err);
      setError("Failed to upload plan set");
    } finally {
      setUploadingPlan(false);
    }
  };

  // Handle drag and drop for plans
  const handlePlanDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadPlanSet(files[0]);
    }
  };

  const handlePlanDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handlePlanDragLeave = () => {
    setDragOver(false);
  };

  const getStatusBadge = (task: DocumentTask) => {
    if (task.is_validated) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle className="h-3 w-3 mr-1" />Validated</Badge>;
    }
    if (task.has_document) {
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"><Paperclip className="h-3 w-3 mr-1" />Attached</Badge>;
    }
    return <Badge variant="secondary">Pending</Badge>;
  };

  // Document Tasks View
  const renderTasksView = () => {
    if (documentCategories.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No documentation categories found.</p>
            <p className="text-sm text-muted-foreground mt-1">Please create categories in Settings.</p>
          </CardContent>
        </Card>
      );
    }

    // Get the current active category (either the subcategory or the parent if no children)
    const activeCategory = selectedSubCategory || selectedCategory;

    return (
      <div className="space-y-4">
        {/* Main Tabs (Parent Categories) */}
        <Tabs
          value={String(selectedCategory?.id)}
          onValueChange={(val) => {
            const cat = documentCategories.find((c) => String(c.id) === val);
            if (cat) setSelectedCategory(cat);
          }}
        >
          <TabsList className="w-full justify-start overflow-x-auto bg-muted/50 p-1">
            {documentCategories.map((cat) => (
              <TabsTrigger
                key={cat.id}
                value={String(cat.id)}
                className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                {cat.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Sub Tabs (Child Categories) - only show if selected parent has children */}
        {selectedCategory?.children && selectedCategory.children.length > 0 && (
          <Tabs
            value={String(selectedSubCategory?.id)}
            onValueChange={(val) => {
              const subCat = selectedCategory.children?.find((c) => String(c.id) === val);
              if (subCat) setSelectedSubCategory(subCat);
            }}
          >
            <TabsList className="w-full justify-start overflow-x-auto h-auto flex-wrap gap-1 bg-transparent p-0">
              {selectedCategory.children.map((subCat) => (
                <TabsTrigger
                  key={subCat.id}
                  value={String(subCat.id)}
                  className="border border-border bg-muted text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {subCat.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {/* Content for the active category */}
        {loadingTasks ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Tasks Table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Folder className="h-5 w-5 text-yellow-500" />
                  {activeCategory?.name}
                  {activeCategory?.folder_path && (
                    <span className="text-xs text-muted-foreground font-normal">
                      ({activeCategory.folder_path})
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {tasks.length === 0 ? (
                  <div className="py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No document tasks in this category.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Uploaded</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell>
                            <div className="flex items-start gap-3">
                              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                              <div>
                                <p className="font-medium">{task.name}</p>
                                <p className="text-sm text-muted-foreground">{task.description}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(task)}</TableCell>
                          <TableCell>
                            {task.uploaded_at ? new Date(task.uploaded_at).toLocaleDateString() : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <label className="cursor-pointer">
                                <input
                                  type="file"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleTaskUpload(task.id, file);
                                  }}
                                  disabled={uploading === task.id}
                                />
                                <Button variant="ghost" size="sm" asChild disabled={uploading === task.id}>
                                  <span>
                                    {uploading === task.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Upload className="h-4 w-4 mr-1" />
                                    )}
                                    {task.has_document ? "Replace" : "Upload"}
                                  </span>
                                </Button>
                              </label>
                              {task.has_document && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => task.document_url && window.open(task.document_url, "_blank")}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  View
                                </Button>
                              )}
                              {task.has_document && !task.is_validated && (
                                <Button variant="ghost" size="sm" onClick={() => handleValidate(task.id)}>
                                  <ShieldCheck className="h-4 w-4 mr-1" />
                                  Validate
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  };

  // OneDrive View
  const renderOneDriveView = () => {
    if (orgStatus.loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (!orgStatus.connected) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Cloud className="h-16 w-16 text-muted-foreground mx-auto" />
            <h3 className="mt-4 text-lg font-semibold">SharePoint Not Connected</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Your organization hasn't connected SharePoint yet. An admin needs to connect Microsoft 365 in Settings first.
            </p>
            <Button asChild className="mt-6">
              <Link href="/settings/integrations/microsoft">
                <Settings className="h-4 w-4 mr-2" />
                Go to Settings
              </Link>
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (!jobFolderStatus.exists) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Folder className="h-16 w-16 text-yellow-500 mx-auto" />
            <h3 className="mt-4 text-lg font-semibold">Create Folder Structure</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Create the folder structure in SharePoint for {jobTitle || "this job"}.
            </p>
            <div className="mt-6 flex gap-3 justify-center">
              <Button onClick={handleCreateFolders} disabled={creatingFolders}>
                {creatingFolders ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Folders...
                  </>
                ) : (
                  <>
                    <Folder className="h-4 w-4 mr-2" />
                    Create Folder Structure
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={openImportModal}>
                <FolderInput className="h-4 w-4 mr-2" />
                Import from Legacy
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Or import existing documents from the legacy SharePoint folder
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {/* Success header */}
        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold">SharePoint Connected</h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Job folder found for {jobTitle || "this job"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={openImportModal}>
                  <FolderInput className="h-4 w-4 mr-1" />
                  Import from Legacy
                </Button>
                <Button variant="outline" size="sm" onClick={checkJobFolderStatus}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh
                </Button>
                {jobFolderStatus.webUrl && (
                  <Button variant="outline" size="sm" onClick={() => window.open(jobFolderStatus.webUrl!, "_blank")}>
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open in SharePoint
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Folders list or folder contents */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              {currentFolderId ? (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={navigateBack}>
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    {folderPath.map((p, i) => (
                      <span key={p.id} className="flex items-center">
                        {i > 0 && <ChevronRight className="h-3 w-3 mx-1" />}
                        <span className={i === folderPath.length - 1 ? "font-medium text-foreground" : ""}>
                          {p.name}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <CardTitle className="text-base">Folder Structure</CardTitle>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingContents ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : currentFolderId ? (
              // Show folder contents
              folderContents.length > 0 ? (
                <div className="divide-y">
                  {folderContents.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors group ${item.folder ? "cursor-pointer" : ""}`}
                      onClick={() => item.folder && loadFolderContents(item.id, item.name)}
                    >
                      <div className="flex items-center gap-3">
                        {item.folder ? (
                          <>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            <Folder className="h-5 w-5 text-yellow-500" />
                          </>
                        ) : (
                          <>
                            <div className="w-4" />
                            <File className="h-5 w-5 text-blue-500" />
                          </>
                        )}
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.lastModifiedDateTime && `Modified ${new Date(item.lastModifiedDateTime).toLocaleDateString()}`}
                            {item.size && ` • ${formatFileSize(item.size)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.folder && (
                          <span className="text-xs text-muted-foreground">
                            {item.folder.childCount || 0} items
                          </span>
                        )}
                        {!item.folder && (
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); window.open(item.webUrl, "_blank"); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); window.open(item.webUrl, "_blank"); }}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Folder className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="mt-2 text-sm text-muted-foreground">This folder is empty.</p>
                </div>
              )
            ) : (
              // Show top-level folders
              folders.length > 0 ? (
                <div className="divide-y">
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors group cursor-pointer"
                      onClick={() => loadFolderContents(folder.id, folder.name)}
                    >
                      <div className="flex items-center gap-3">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        <Folder className="h-5 w-5 text-yellow-500" />
                        <div>
                          <p className="text-sm font-medium">{folder.name}</p>
                          {folder.lastModifiedDateTime && (
                            <p className="text-xs text-muted-foreground">
                              Modified {new Date(folder.lastModifiedDateTime).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs text-muted-foreground">
                          {folder.folder?.childCount || 0} items
                        </span>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleUpload(folder.id); }}>
                          <Upload className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); window.open(folder.webUrl, "_blank"); }}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Folder className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="mt-2 text-sm text-muted-foreground">No folders found. Try refreshing.</p>
                </div>
              )
            )}
          </CardContent>
        </Card>

        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
      </div>
    );
  };

  // All Files View - shows all files in the job folder recursively
  const renderAllFilesView = () => {
    if (orgStatus.loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (!orgStatus.connected) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Cloud className="h-16 w-16 text-muted-foreground mx-auto" />
            <h3 className="mt-4 text-lg font-semibold">SharePoint Not Connected</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Your organization hasn't connected SharePoint yet. An admin needs to connect Microsoft 365 in Settings first.
            </p>
            <Button asChild className="mt-6">
              <Link href="/settings/integrations/microsoft">
                <Settings className="h-4 w-4 mr-2" />
                Go to Settings
              </Link>
            </Button>
          </CardContent>
        </Card>
      );
    }

    // Get files with pending AI suggestions
    const filesWithSuggestions = allFiles.filter(
      f => f.ai_analyzed && f.ai_proposed_name && f.rename_status === "pending"
    );

    return (
      <div className="space-y-4">
        {/* Header with refresh and open in SharePoint */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">All Files</h3>
            <span className="text-sm text-muted-foreground">
              {loadingAllFiles ? "Loading..." : `${allFiles.length} files`}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAnalyzeDocuments}
              disabled={analyzingDocs || loadingAllFiles}
            >
              {analyzingDocs ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Analyze with AI
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadAllFiles}
              disabled={loadingAllFiles}
            >
              {loadingAllFiles ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Refresh
            </Button>
            {allFilesJobFolderUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(allFilesJobFolderUrl, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open in SharePoint
              </Button>
            )}
          </div>
        </div>

        {/* AI Stats */}
        {aiStats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Card className="bg-muted/50">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold">{aiStats.total}</div>
                <div className="text-xs text-muted-foreground">Total Files</div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 dark:bg-green-950/30">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{aiStats.analyzed}</div>
                <div className="text-xs text-muted-foreground">Analyzed</div>
              </CardContent>
            </Card>
            <Card className="bg-yellow-50 dark:bg-yellow-950/30">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-yellow-600">{aiStats.pending_review}</div>
                <div className="text-xs text-muted-foreground">Pending Review</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 dark:bg-blue-950/30">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{aiStats.approved}</div>
                <div className="text-xs text-muted-foreground">Approved</div>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold">{aiStats.unanalyzed}</div>
                <div className="text-xs text-muted-foreground">Unanalyzed</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Suggested Renames Section */}
        {filesWithSuggestions.length > 0 && (
          <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-600" />
                AI Suggested Renames ({filesWithSuggestions.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {filesWithSuggestions.slice(0, 10).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-background rounded-lg border"
                  >
                    <div className="flex-1 min-w-0 mr-4">
                      <div className="flex items-center gap-2 text-sm">
                        <File className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        <span className="truncate text-muted-foreground">{item.name}</span>
                        <ArrowRight className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                        <span className="truncate font-medium text-foreground">{item.ai_proposed_name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {item.ai_suggested_type_name && (
                          <Badge variant="secondary" className="text-xs">
                            {item.ai_suggested_type_name}
                          </Badge>
                        )}
                        {item.ai_confidence && (
                          <span className={`${item.ai_confidence >= 80 ? "text-green-600" : item.ai_confidence >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                            {item.ai_confidence}% confidence
                          </span>
                        )}
                        {item.folder_path && (
                          <span className="text-blue-600">{item.folder_path}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                        onClick={() => item.document_id && handleApproveRename(item.document_id, "approve")}
                        disabled={approvingDoc === item.document_id}
                        title="Approve rename"
                      >
                        {approvingDoc === item.document_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                        onClick={() => item.document_id && handleApproveRename(item.document_id, "reject")}
                        disabled={approvingDoc === item.document_id}
                        title="Reject rename"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {filesWithSuggestions.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    And {filesWithSuggestions.length - 10} more suggestions...
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Files table */}
        <Card>
          <CardContent className="p-0">
            {loadingAllFiles ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Folder</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>AI Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allFiles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No files found
                      </TableCell>
                    </TableRow>
                  ) : (
                    allFiles.map((item) => (
                      <TableRow key={item.id} className={item.rename_status === "completed" ? "bg-green-50/50 dark:bg-green-950/20" : ""}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <File className="h-4 w-4 text-blue-500 flex-shrink-0" />
                            <div className="min-w-0">
                              <span className="text-sm truncate block max-w-[300px]">{item.name}</span>
                              {item.original_name && item.name !== item.original_name && (
                                <span className="text-xs text-muted-foreground line-through block">{item.original_name}</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {item.folder_path || "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {item.ai_suggested_type_name ? (
                            <Badge variant="secondary" className="text-xs">
                              {item.ai_suggested_type_name}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.rename_status === "completed" ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Renamed
                            </Badge>
                          ) : item.rename_status === "rejected" ? (
                            <Badge variant="secondary" className="text-muted-foreground">
                              Skipped
                            </Badge>
                          ) : item.ai_analyzed ? (
                            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                              <Sparkles className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.web_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => window.open(item.web_url, "_blank")}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // Format date for display
  const formatPlanDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Plans View - displays plans from 04 Plans folder
  const renderPlansView = () => {
    // Separate "All Plans" from individual pages
    const allPlans = plans.find((p) => p.is_all_plans);
    const individualPlans = plans.filter((p) => !p.is_all_plans);

    return (
      <div className="space-y-4">
        {/* Drop Zone - compact when plans exist */}
        <Card>
          <CardContent className={plans.length > 0 ? "p-4" : "p-6"}>
            <div
              className={`border-2 border-dashed rounded-lg transition-colors ${
                plans.length > 0 ? "p-4" : "p-8"
              } text-center ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDrop={handlePlanDrop}
              onDragOver={handlePlanDragOver}
              onDragLeave={handlePlanDragLeave}
            >
              {uploadingPlan ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  <p className="font-medium">Processing plan set...</p>
                  <p className="text-sm text-muted-foreground">
                    Extracting pages and uploading to SharePoint
                  </p>
                </div>
              ) : (
                <div className={`flex ${plans.length > 0 ? "items-center justify-center gap-4" : "flex-col items-center"}`}>
                  <Upload className={`${plans.length > 0 ? "h-6 w-6" : "h-10 w-10 mb-3"} text-muted-foreground`} />
                  <div className={plans.length > 0 ? "" : "text-center"}>
                    <p className={`font-medium ${plans.length > 0 ? "text-sm" : "text-lg mb-1"}`}>
                      {plans.length > 0 ? "Drop PDF to upload new plan set" : "Drop PDF Plan Set Here"}
                    </p>
                    {plans.length === 0 && (
                      <p className="text-sm text-muted-foreground mb-4">
                        The PDF will be split into individual pages
                      </p>
                    )}
                  </div>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadPlanSet(file);
                        e.target.value = "";
                      }}
                    />
                    <Button variant="outline" size={plans.length > 0 ? "sm" : "default"} asChild>
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        Browse
                      </span>
                    </Button>
                  </label>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Plans Split View - List + Preview */}
        {plans.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Panel - Plans List */}
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="pb-3 shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Folder className="h-5 w-5 text-blue-500" />
                    Plans ({plans.length})
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={loadPlans}
                      disabled={loadingPlans}
                    >
                      <RefreshCw className={`h-4 w-4 ${loadingPlans ? "animate-spin" : ""}`} />
                    </Button>
                    {plansFolderUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(plansFolderUrl, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-0">
                {loadingPlans ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="divide-y">
                    {/* All Plans entry - always first */}
                    {allPlans && (
                      <div
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                          selectedPlan?.id === allPlans.id
                            ? "bg-primary/10 border-l-2 border-l-primary"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => setSelectedPlan(allPlans)}
                      >
                        <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{allPlans.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="secondary" className="text-xs">Full Set</Badge>
                            {allPlans.modified && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatPlanDate(allPlans.modified)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Individual plan pages */}
                    {individualPlans.map((plan) => (
                      <div
                        key={plan.id}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                          selectedPlan?.id === plan.id
                            ? "bg-primary/10 border-l-2 border-l-primary"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => setSelectedPlan(plan)}
                      >
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate" title={plan.name}>
                            {plan.name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {plan.size && <span>{formatFileSize(plan.size)}</span>}
                            {plan.modified && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatPlanDate(plan.modified)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right Panel - Preview */}
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="pb-3 shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {selectedPlan ? "Preview" : "Select a Plan"}
                  </CardTitle>
                  {selectedPlan && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(selectedPlan.web_url, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open in SharePoint
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                {selectedPlan ? (
                  <div className="h-full flex flex-col">
                    {/* Plan Info */}
                    <div className="px-4 pb-3 border-b shrink-0">
                      <h3 className="font-medium truncate" title={selectedPlan.name}>
                        {selectedPlan.name}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        {selectedPlan.is_all_plans && (
                          <Badge variant="secondary">Full Set</Badge>
                        )}
                        {selectedPlan.size && (
                          <span>{formatFileSize(selectedPlan.size)}</span>
                        )}
                        {selectedPlan.modified && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatPlanDate(selectedPlan.modified)}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* PDF Preview iframe */}
                    <div className="flex-1 bg-muted/20">
                      <iframe
                        src={`${selectedPlan.web_url}?action=embedview`}
                        className="w-full h-full border-0"
                        title={`Preview: ${selectedPlan.name}`}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <FileText className="h-16 w-16 mb-4 opacity-50" />
                    <p>Select a plan from the list to preview</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty state when no plans */}
        {plans.length === 0 && !loadingPlans && (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No plans uploaded yet.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Drop a PDF plan set above to get started.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
          <CardContent className="p-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </CardContent>
        </Card>
      )}
      {message && (
        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CardContent className="p-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-sm text-green-700 dark:text-green-300">{message.text}</p>
          </CardContent>
        </Card>
      )}

      {/* View Mode Toggle */}
      <div className="flex items-center gap-2 bg-muted rounded-lg p-1 w-fit">
        <Button
          variant={viewMode === "tasks" ? "default" : "ghost"}
          size="sm"
          onClick={() => setViewMode("tasks")}
        >
          <FileText className="h-4 w-4 mr-2" />
          Document Tasks
        </Button>
        <Button
          variant={viewMode === "onedrive" ? "default" : "ghost"}
          size="sm"
          onClick={() => setViewMode("onedrive")}
        >
          <Cloud className="h-4 w-4 mr-2" />
          SharePoint Folders
        </Button>
        <Button
          variant={viewMode === "allfiles" ? "default" : "ghost"}
          size="sm"
          onClick={() => setViewMode("allfiles")}
        >
          <Folder className="h-4 w-4 mr-2" />
          All Files
        </Button>
        <Button
          variant={viewMode === "plans" ? "default" : "ghost"}
          size="sm"
          onClick={() => setViewMode("plans")}
        >
          <FileText className="h-4 w-4 mr-2" />
          Plans
        </Button>
      </div>

      {viewMode === "tasks" && renderTasksView()}
      {viewMode === "onedrive" && renderOneDriveView()}
      {viewMode === "allfiles" && renderAllFilesView()}
      {viewMode === "plans" && renderPlansView()}

      {/* Import Legacy Files Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderInput className="h-5 w-5" />
              Import from Legacy Folder
            </DialogTitle>
            <DialogDescription>
              Select files from the old SharePoint folder to import into this job's folder.
              Files will be automatically categorized and moved.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0">
            {loadingLegacy ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-3 text-muted-foreground">Searching for files...</span>
              </div>
            ) : legacyItems.length === 0 ? (
              <div className="py-12 text-center">
                <Folder className="h-12 w-12 text-muted-foreground mx-auto" />
                <p className="mt-2 text-muted-foreground">No legacy files found for this job.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  The old folder structure may not contain files matching this job.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Select All - all files from all subfolders */}
                <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <Checkbox
                    id="select-all"
                    checked={
                      selectedLegacyFiles.length > 0 &&
                      selectedLegacyFiles.length === legacyItems.length
                    }
                    onCheckedChange={selectAllFiles}
                  />
                  <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                    Select All ({legacyItems.length} files)
                  </label>
                </div>

                {/* Files list - flat list with folder paths */}
                <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
                  {legacyItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => toggleFileSelection(item.id)}
                    >
                      <Checkbox
                        checked={selectedLegacyFiles.includes(item.id)}
                        onCheckedChange={() => toggleFileSelection(item.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <File className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.folder_path && (
                            <span className="text-blue-600 dark:text-blue-400">{item.folder_path}/</span>
                          )}
                          {item.size ? formatFileSize(item.size) : ""}
                          {item.modified && ` • Modified ${new Date(item.modified).toLocaleDateString()}`}
                        </p>
                      </div>
                      {item.web_url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(item.web_url, "_blank");
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowImportModal(false)} disabled={importing}>
              Cancel
            </Button>
            <Button
              onClick={handleImportLegacy}
              disabled={importing || selectedLegacyFiles.length === 0}
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Import {selectedLegacyFiles.length} {selectedLegacyFiles.length === 1 ? "File" : "Files"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default JobDocumentsTab;
