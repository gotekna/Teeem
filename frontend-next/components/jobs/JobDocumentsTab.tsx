"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  XCircle,
  Eye,
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
  name: string;
  size?: number;
  web_url?: string;
  modified?: string;
  type: "file" | "folder";
  child_count?: number;
}

interface LegacyFolderPath {
  id: string;
  name: string;
}

interface JobDocumentsTabProps {
  jobId: string | number;
  jobTitle?: string;
}

export function JobDocumentsTab({ jobId, jobTitle }: JobDocumentsTabProps) {
  const [viewMode, setViewMode] = useState<"tasks" | "onedrive">("tasks");
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
  const [legacyFolderPath, setLegacyFolderPath] = useState<LegacyFolderPath[]>([]);

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
  // Supports folder navigation with optional folder_id parameter
  const loadLegacyFiles = async (folderId?: string) => {
    try {
      setLoadingLegacy(true);
      setError(null);
      const url = folderId
        ? `/api/v1/organization_onedrive/legacy_files?job_id=${jobId}&folder_id=${folderId}`
        : `/api/v1/organization_onedrive/legacy_files?job_id=${jobId}`;

      const response = await api.get<{
        success: boolean;
        items: LegacyItem[];
        count: number;
        source_folder: string;
        current_folder_id?: string;
      }>(url);

      if (response?.success) {
        setLegacyItems(response.items || []);
        // Only clear selection when navigating to a new folder
        if (!folderId) {
          setSelectedLegacyFiles([]);
          setLegacyFolderPath([]);
        }
      }
    } catch (err) {
      console.error("Failed to load legacy files:", err);
      setLegacyItems([]);
    } finally {
      setLoadingLegacy(false);
    }
  };

  // Navigate into a legacy subfolder
  const navigateLegacyFolder = async (folder: LegacyItem) => {
    setLegacyFolderPath((prev) => [...prev, { id: folder.id, name: folder.name }]);
    await loadLegacyFiles(folder.id);
  };

  // Navigate back in legacy folder hierarchy
  const navigateLegacyBack = async () => {
    if (legacyFolderPath.length === 0) return;

    const newPath = legacyFolderPath.slice(0, -1);
    setLegacyFolderPath(newPath);

    if (newPath.length === 0) {
      // Go back to root
      await loadLegacyFiles();
    } else {
      // Go to parent folder
      await loadLegacyFiles(newPath[newPath.length - 1].id);
    }
  };

  // Navigate to a specific point in the breadcrumb
  const navigateLegacyToPath = async (index: number) => {
    if (index < 0) {
      // Go to root
      setLegacyFolderPath([]);
      await loadLegacyFiles();
    } else {
      const newPath = legacyFolderPath.slice(0, index + 1);
      setLegacyFolderPath(newPath);
      await loadLegacyFiles(newPath[index].id);
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
  const toggleFileSelection = (fileId: string) => {
    setSelectedLegacyFiles((prev) =>
      prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId]
    );
  };

  // Select all files (only files, not folders)
  const selectAllFiles = () => {
    const allFiles = legacyItems.filter((i) => i.type === "file");
    if (selectedLegacyFiles.length === allFiles.length && allFiles.length > 0) {
      setSelectedLegacyFiles([]);
    } else {
      setSelectedLegacyFiles(allFiles.map((f) => f.id));
    }
  };

  const getStatusBadge = (task: DocumentTask) => {
    if (task.is_validated) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle className="h-3 w-3 mr-1" />Validated</Badge>;
    }
    if (task.has_document) {
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"><Paperclip className="h-3 w-3 mr-1" />Attached</Badge>;
    }
    if (task.required) {
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Required</Badge>;
    }
    return <Badge variant="secondary">Optional</Badge>;
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
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">
                    {tasks.filter((t) => t.has_document).length}/{tasks.length}
                  </div>
                  <p className="text-sm text-muted-foreground">Documents Attached</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-green-600">
                    {tasks.filter((t) => t.is_validated).length}/{tasks.length}
                  </div>
                  <p className="text-sm text-muted-foreground">Validated</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-red-600">
                    {tasks.filter((t) => t.required && !t.has_document).length}
                  </div>
                  <p className="text-sm text-muted-foreground">Required Missing</p>
                </CardContent>
              </Card>
            </div>

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
                                <p className="font-medium">
                                  {task.name}
                                  {task.required && <span className="text-red-500 ml-1">*</span>}
                                </p>
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
      </div>

      {viewMode === "tasks" ? renderTasksView() : renderOneDriveView()}

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
                {/* Breadcrumb navigation */}
                {legacyFolderPath.length > 0 && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={navigateLegacyBack}
                      className="h-8 px-2"
                    >
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground overflow-x-auto">
                      <button
                        className="hover:text-foreground cursor-pointer"
                        onClick={() => navigateLegacyToPath(-1)}
                      >
                        Root
                      </button>
                      {legacyFolderPath.map((folder, index) => (
                        <span key={folder.id} className="flex items-center">
                          <ChevronRight className="h-3 w-3 mx-1 flex-shrink-0" />
                          <button
                            className={`hover:text-foreground cursor-pointer truncate max-w-[150px] ${
                              index === legacyFolderPath.length - 1 ? "font-medium text-foreground" : ""
                            }`}
                            onClick={() => navigateLegacyToPath(index)}
                          >
                            {folder.name}
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Select All (only show if there are files) */}
                {legacyItems.some((i) => i.type === "file") && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <Checkbox
                      id="select-all"
                      checked={
                        selectedLegacyFiles.length > 0 &&
                        selectedLegacyFiles.length === legacyItems.filter((i) => i.type === "file").length
                      }
                      onCheckedChange={selectAllFiles}
                    />
                    <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                      Select All ({legacyItems.filter((i) => i.type === "file").length} files)
                    </label>
                  </div>
                )}

                {/* Items list (folders and files) */}
                <div className="border rounded-lg divide-y">
                  {legacyItems.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer ${
                        item.type === "folder" ? "bg-muted/30" : ""
                      }`}
                      onClick={() =>
                        item.type === "folder"
                          ? navigateLegacyFolder(item)
                          : toggleFileSelection(item.id)
                      }
                    >
                      {item.type === "folder" ? (
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <Checkbox
                          checked={selectedLegacyFiles.includes(item.id)}
                          onCheckedChange={() => toggleFileSelection(item.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                      {item.type === "folder" ? (
                        <Folder className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                      ) : (
                        <File className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.type === "folder"
                            ? `${item.child_count || 0} items`
                            : `${item.size ? formatFileSize(item.size) : ""}${
                                item.modified
                                  ? ` • Modified ${new Date(item.modified).toLocaleDateString()}`
                                  : ""
                              }`}
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
